/**
 * GiraMundoTour - Rotas de Clientes
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Adiciona coluna cnpj se ainda não existir
pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18)`)
    .catch(err => console.error('[clientes] erro ao adicionar coluna cnpj:', err));

/**
 * GET /api/clientes
 */
router.get('/', async (req, res) => {
    try {
        const { busca, ativo, page = 1, limit = 1000 } = req.query;
        const conditions = [];
        const values = [];
        let idx = 1;

        if (busca) {
            conditions.push(`(nome ILIKE $${idx} OR email ILIKE $${idx} OR cpf ILIKE $${idx} OR telefone ILIKE $${idx} OR cnpj ILIKE $${idx})`);
            values.push(`%${busca}%`);
            idx++;
        }

        if (ativo !== undefined) {
            conditions.push(`ativo = $${idx++}`);
            values.push(ativo === 'true');
        }

        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [clientesRes, countRes] = await Promise.all([
            pool.query(
                `SELECT c.*,
                    (SELECT COUNT(*) FROM bilhetes b WHERE b."clienteId" = c.id) AS "_countBilhetes",
                    (SELECT COUNT(*) FROM cotacoes co WHERE co."clienteId" = c.id) AS "_countCotacoes"
                 FROM clientes c ${where} ORDER BY nome ASC LIMIT $${idx} OFFSET $${idx + 1}`,
                [...values, parseInt(limit), offset]
            ),
            pool.query(`SELECT COUNT(*) FROM clientes ${where}`, values)
        ]);

        const total = parseInt(countRes.rows[0].count);

        res.json({
            success: true,
            data: clientesRes.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/clientes/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const [clienteRes, bilhetesRes, cotacoesRes] = await Promise.all([
            pool.query('SELECT * FROM clientes WHERE id = $1', [req.params.id]),
            pool.query('SELECT * FROM bilhetes WHERE "clienteId" = $1 ORDER BY "dataEmissao" DESC LIMIT 10', [req.params.id]),
            pool.query('SELECT * FROM cotacoes WHERE "clienteId" = $1 ORDER BY "createdAt" DESC LIMIT 10', [req.params.id])
        ]);

        if (clienteRes.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'Cliente não encontrado' });
        }

        const cliente = { ...clienteRes.rows[0], bilhetes: bilhetesRes.rows, cotacoes: cotacoesRes.rows };
        res.json({ success: true, data: cliente });
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * POST /api/clientes
 */
router.post('/', [
    body('nome').notEmpty().withMessage('Nome é obrigatório'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email inválido'),
    body('cpf').optional({ checkFalsy: true }).isLength({ min: 11, max: 14 }).withMessage('CPF inválido')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: true, errors: errors.array() });
        }

        const { nome, email, telefone, cpf, cnpj, rg, endereco, cidade, estado, cep, dataNasc, observacoes } = req.body;
        const cpfLimpo  = cpf  ? cpf.replace(/\D/g, '')  : null;
        const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, '') : null;

        // Validações de duplicidade
        const { rows: nomeExiste } = await pool.query(
            'SELECT id FROM clientes WHERE LOWER(nome) = LOWER($1)', [nome]
        );
        if (nomeExiste.length > 0) {
            return res.status(400).json({ error: true, message: `Cliente "${nome}" já está cadastrado` });
        }

        if (cpfLimpo) {
            const { rows: cpfExiste } = await pool.query('SELECT id FROM clientes WHERE cpf = $1', [cpfLimpo]);
            if (cpfExiste.length > 0) {
                return res.status(400).json({ error: true, message: 'CPF já cadastrado para outro cliente' });
            }
        }

        if (cnpjLimpo) {
            const { rows: cnpjExiste } = await pool.query('SELECT id FROM clientes WHERE cnpj = $1', [cnpjLimpo]);
            if (cnpjExiste.length > 0) {
                return res.status(400).json({ error: true, message: 'CNPJ já cadastrado para outro cliente' });
            }
        }

        if (email) {
            const emailLower = email.toLowerCase();
            const { rows: emailExiste } = await pool.query('SELECT id FROM clientes WHERE email = $1', [emailLower]);
            if (emailExiste.length > 0) {
                return res.status(400).json({ error: true, message: 'E-mail já cadastrado para outro cliente' });
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO clientes (id, nome, email, telefone, cpf, cnpj, rg, endereco, cidade, estado, cep, "dataNasc", observacoes, ativo, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW())
             RETURNING *`,
            [nome, email?.toLowerCase() || null, telefone || null, cpfLimpo, cnpjLimpo, rg || null,
             endereco || null, cidade || null, estado || null, cep ? cep.replace(/\D/g, '') : null,
             dataNasc ? new Date(dataNasc) : null, observacoes || null]
        );

        res.status(201).json({ success: true, message: 'Cliente criado com sucesso', data: rows[0] });
    } catch (error) {
        console.error('Erro ao criar cliente:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * PUT /api/clientes/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { nome, email, telefone, cpf, cnpj, rg, endereco, cidade, estado, cep, dataNasc, observacoes, ativo } = req.body;

        const sets = [];
        const values = [];
        let idx = 1;

        if (nome !== undefined)      { sets.push(`nome = $${idx++}`);       values.push(nome); }
        if (email !== undefined)     { sets.push(`email = $${idx++}`);      values.push(email?.toLowerCase() || null); }
        if (telefone !== undefined)  { sets.push(`telefone = $${idx++}`);   values.push(telefone || null); }
        if (cpf !== undefined)       { sets.push(`cpf = $${idx++}`);        values.push(cpf ? cpf.replace(/\D/g, '') : null); }
        if (cnpj !== undefined)      { sets.push(`cnpj = $${idx++}`);       values.push(cnpj ? cnpj.replace(/\D/g, '') : null); }
        if (rg !== undefined)        { sets.push(`rg = $${idx++}`);         values.push(rg || null); }
        if (endereco !== undefined)  { sets.push(`endereco = $${idx++}`);   values.push(endereco || null); }
        if (cidade !== undefined)    { sets.push(`cidade = $${idx++}`);     values.push(cidade || null); }
        if (estado !== undefined)    { sets.push(`estado = $${idx++}`);     values.push(estado || null); }
        if (cep !== undefined)       { sets.push(`cep = $${idx++}`);        values.push(cep ? cep.replace(/\D/g, '') : null); }
        if (dataNasc !== undefined)  { sets.push(`"dataNasc" = $${idx++}`); values.push(dataNasc ? new Date(dataNasc) : null); }
        if (observacoes !== undefined){ sets.push(`observacoes = $${idx++}`); values.push(observacoes || null); }
        if (typeof ativo === 'boolean') { sets.push(`ativo = $${idx++}`);   values.push(ativo); }

        if (sets.length === 0) return res.status(400).json({ error: true, message: 'Nenhum campo para atualizar' });

        sets.push(`"updatedAt" = NOW()`);
        values.push(req.params.id);

        const { rows } = await pool.query(
            `UPDATE clientes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (rows.length === 0) return res.status(404).json({ error: true, message: 'Cliente não encontrado' });

        res.json({ success: true, message: 'Cliente atualizado', data: rows[0] });
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * DELETE /api/clientes/:id (soft delete)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { rows: reservas } = await pool.query(
            'SELECT id FROM reservas WHERE "clienteId" = $1 LIMIT 1',
            [req.params.id]
        );
        if (reservas.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível excluir este cliente pois existem reservas ativas vinculadas a ele.'
            });
        }

        await pool.query(
            'UPDATE clientes SET ativo = false, "updatedAt" = NOW() WHERE id = $1',
            [req.params.id]
        );
        res.json({ success: true, message: 'Cliente desativado com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
