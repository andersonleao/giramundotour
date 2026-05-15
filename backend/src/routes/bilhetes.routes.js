/**
 * GiraMundoTour - Rotas de Bilhetes
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');
const multer = require('multer');
const { extractTextFromPDF } = require('../services/pdfExtractor');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Apenas arquivos PDF são aceitos'));
    }
});

/**
 * POST /api/bilhetes/extract-pdf (sem auth)
 */
router.post('/extract-pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: true, message: 'Nenhum arquivo PDF enviado' });
        }

        console.log(`[ExtractPDF] Recebido: ${req.file.originalname} (${req.file.size} bytes)`);
        const result = await extractTextFromPDF(req.file.buffer);
        console.log(`[ExtractPDF] Texto extraído: ${result.text.length} chars via ${result.method}`);

        res.json({ success: true, text: result.text, method: result.method, pages: result.pages });
    } catch (error) {
        console.error('[ExtractPDF] Erro:', error);
        res.status(500).json({ error: true, message: 'Erro ao processar PDF: ' + error.message });
    }
});

router.use(authMiddleware);

/**
 * GET /api/bilhetes
 */
router.get('/', async (req, res) => {
    try {
        const { busca, clienteId, fornecedorId, dataInicio, dataFim, page = 1, limit = 200 } = req.query;
        const conditions = [];
        const values = [];
        let idx = 1;

        if (busca) {
            conditions.push(`(b."codigoReserva" ILIKE $${idx} OR b.companhia ILIKE $${idx} OR b."passageiroNome" ILIKE $${idx} OR c.nome ILIKE $${idx})`);
            values.push(`%${busca}%`);
            idx++;
        }

        if (clienteId)    { conditions.push(`b."clienteId" = $${idx++}`);    values.push(clienteId); }
        if (fornecedorId) { conditions.push(`b."fornecedorId" = $${idx++}`); values.push(fornecedorId); }

        if (dataInicio) {
            conditions.push(`b."dataEmissao" >= $${idx++}`);
            values.push(new Date(dataInicio));
        }
        if (dataFim) {
            conditions.push(`b."dataEmissao" <= $${idx++}`);
            values.push(new Date(dataFim + 'T23:59:59'));
        }

        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [bilhetesRes, countRes, totaisRes] = await Promise.all([
            pool.query(
                `SELECT b.*,
                    c.id AS "clienteId_rel", c.nome AS "clienteNome", c.email AS "clienteEmail", c.telefone AS "clienteTelefone",
                    f.id AS "fornecedorId_rel", f.nome AS "fornecedorNome", f.telegram AS "fornecedorTelegram", f.balcao AS "fornecedorBalcao"
                 FROM bilhetes b
                 LEFT JOIN clientes c ON c.id = b."clienteId"
                 LEFT JOIN fornecedores f ON f.id = b."fornecedorId"
                 ${where} ORDER BY b."createdAt" DESC LIMIT $${idx} OFFSET $${idx + 1}`,
                [...values, parseInt(limit), offset]
            ),
            pool.query(
                `SELECT COUNT(*) FROM bilhetes b LEFT JOIN clientes c ON c.id = b."clienteId" ${where}`,
                values
            ),
            pool.query(
                `SELECT COALESCE(SUM(b."valorVenda"),0) AS "somaVendas", COALESCE(SUM(b."valorCompra"),0) AS "somaCompras"
                 FROM bilhetes b LEFT JOIN clientes c ON c.id = b."clienteId" ${where}`,
                values
            )
        ]);

        const total = parseInt(countRes.rows[0].count);
        const { somaVendas, somaCompras } = totaisRes.rows[0];

        // Montar objetos com relações
        const bilhetes = bilhetesRes.rows.map(r => {
            const b = { ...r };
            b.cliente    = r.clienteNome    ? { id: r['clienteId_rel'],    nome: r.clienteNome,    email: r.clienteEmail,    telefone: r.clienteTelefone }    : null;
            b.fornecedor = r.fornecedorNome ? { id: r['fornecedorId_rel'], nome: r.fornecedorNome, telegram: r.fornecedorTelegram, balcao: r.fornecedorBalcao } : null;
            delete b.clienteNome; delete b.clienteEmail; delete b.clienteTelefone;
            delete b.fornecedorNome; delete b.fornecedorTelegram; delete b.fornecedorBalcao;
            delete b['clienteId_rel']; delete b['fornecedorId_rel'];
            return b;
        });

        res.json({
            success: true,
            data: bilhetes,
            totais: { vendas: parseFloat(somaVendas), compras: parseFloat(somaCompras), lucro: parseFloat(somaVendas) - parseFloat(somaCompras) },
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        console.error('Erro ao listar bilhetes:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/bilhetes/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT b.*,
                c.id AS "clienteId_rel", c.nome AS "clienteNome", c.email AS "clienteEmail", c.telefone AS "clienteTelefone", c.cpf AS "clienteCpf",
                f.id AS "fornecedorId_rel", f.nome AS "fornecedorNome", f.telegram AS "fornecedorTelegram", f.balcao AS "fornecedorBalcao"
             FROM bilhetes b
             LEFT JOIN clientes c ON c.id = b."clienteId"
             LEFT JOIN fornecedores f ON f.id = b."fornecedorId"
             WHERE b.id = $1`,
            [req.params.id]
        );

        if (rows.length === 0) return res.status(404).json({ error: true, message: 'Bilhete não encontrado' });

        const r = rows[0];
        const bilhete = { ...r };
        bilhete.cliente    = r.clienteNome    ? { id: r['clienteId_rel'],    nome: r.clienteNome,    email: r.clienteEmail,    telefone: r.clienteTelefone, cpf: r.clienteCpf }    : null;
        bilhete.fornecedor = r.fornecedorNome ? { id: r['fornecedorId_rel'], nome: r.fornecedorNome, telegram: r.fornecedorTelegram, balcao: r.fornecedorBalcao } : null;
        delete bilhete.clienteNome; delete bilhete.clienteEmail; delete bilhete.clienteTelefone; delete bilhete.clienteCpf;
        delete bilhete.fornecedorNome; delete bilhete.fornecedorTelegram; delete bilhete.fornecedorBalcao;
        delete bilhete['clienteId_rel']; delete bilhete['fornecedorId_rel'];

        res.json({ success: true, data: bilhete });
    } catch (error) {
        console.error('Erro ao buscar bilhete:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * POST /api/bilhetes
 */
router.post('/', async (req, res) => {
    try {
        const {
            clienteId, fornecedorId, codigoReserva, companhia,
            origem, destino, dataIda, dataVolta,
            valorVenda, valorCompra, dataEmissao, status, observacoes,
            passageiroNome, passageiros, numeroVoo, vooVolta,
            cabine, bagagem, tarifa, taxaEmbarque,
            horaPartida, horaChegada, trechos
        } = req.body;

        if (!codigoReserva || !companhia) {
            return res.status(400).json({ error: true, message: 'Código da reserva e companhia são obrigatórios' });
        }

        const { rows } = await pool.query(
            `INSERT INTO bilhetes (
                id, "clienteId", "fornecedorId", "codigoReserva", companhia,
                origem, destino, "dataIda", "dataVolta",
                "valorVenda", "valorCompra", "dataEmissao", status, observacoes,
                "passageiroNome", passageiros, "numeroVoo", "vooVolta",
                cabine, bagagem, tarifa, "taxaEmbarque",
                "horaPartida", "horaChegada", trechos, "createdAt", "updatedAt"
             ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4,
                $5, $6, $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19, $20, $21,
                $22, $23, $24, NOW(), NOW()
             ) RETURNING *`,
            [
                clienteId || null, fornecedorId || null, codigoReserva.toUpperCase(), companhia,
                origem ? origem.toUpperCase() : null, destino ? destino.toUpperCase() : null, dataIda || null, dataVolta || null,
                parseFloat(valorVenda) || 0, parseFloat(valorCompra) || 0,
                dataEmissao ? new Date(dataEmissao) : new Date(), status || 'emitido', observacoes || null,
                passageiroNome || null, passageiros ? JSON.stringify(passageiros) : null, numeroVoo || null, vooVolta || null,
                cabine || null, bagagem || null, parseFloat(tarifa) || 0, parseFloat(taxaEmbarque) || 0,
                horaPartida || null, horaChegada || null, trechos ? JSON.stringify(trechos) : null
            ]
        );

        // Buscar com relações
        const bilheteCompleto = await _getBilheteComRelacoes(rows[0].id);
        res.status(201).json({ success: true, message: 'Bilhete emitido com sucesso', data: bilheteCompleto });
    } catch (error) {
        console.error('Erro ao criar bilhete:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * PUT /api/bilhetes/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const {
            clienteId, fornecedorId, codigoReserva, companhia,
            origem, destino, dataIda, dataVolta,
            valorVenda, valorCompra, dataEmissao, status, observacoes,
            passageiroNome, passageiros, numeroVoo, vooVolta,
            cabine, bagagem, tarifa, taxaEmbarque,
            horaPartida, horaChegada, trechos
        } = req.body;

        const sets = [];
        const values = [];
        let idx = 1;

        if (clienteId !== undefined)     { sets.push(`"clienteId" = $${idx++}`);     values.push(clienteId || null); }
        if (fornecedorId !== undefined)  { sets.push(`"fornecedorId" = $${idx++}`);  values.push(fornecedorId || null); }
        if (codigoReserva)               { sets.push(`"codigoReserva" = $${idx++}`); values.push(codigoReserva.toUpperCase()); }
        if (companhia)                   { sets.push(`companhia = $${idx++}`);        values.push(companhia); }
        if (origem !== undefined)        { sets.push(`origem = $${idx++}`);           values.push(origem ? origem.toUpperCase() : null); }
        if (destino !== undefined)       { sets.push(`destino = $${idx++}`);          values.push(destino ? destino.toUpperCase() : null); }
        if (dataIda !== undefined)       { sets.push(`"dataIda" = $${idx++}`);        values.push(dataIda || null); }
        if (dataVolta !== undefined)     { sets.push(`"dataVolta" = $${idx++}`);      values.push(dataVolta || null); }
        if (valorVenda !== undefined)    { sets.push(`"valorVenda" = $${idx++}`);     values.push(parseFloat(valorVenda) || 0); }
        if (valorCompra !== undefined)   { sets.push(`"valorCompra" = $${idx++}`);    values.push(parseFloat(valorCompra) || 0); }
        if (dataEmissao)                 { sets.push(`"dataEmissao" = $${idx++}`);    values.push(new Date(dataEmissao)); }
        if (status)                      { sets.push(`status = $${idx++}`);           values.push(status); }
        if (observacoes !== undefined)   { sets.push(`observacoes = $${idx++}`);      values.push(observacoes || null); }
        if (passageiroNome !== undefined){ sets.push(`"passageiroNome" = $${idx++}`); values.push(passageiroNome || null); }
        if (passageiros !== undefined)   { sets.push(`passageiros = $${idx++}`);      values.push(passageiros ? JSON.stringify(passageiros) : null); }
        if (numeroVoo !== undefined)     { sets.push(`"numeroVoo" = $${idx++}`);      values.push(numeroVoo || null); }
        if (vooVolta !== undefined)      { sets.push(`"vooVolta" = $${idx++}`);       values.push(vooVolta || null); }
        if (cabine !== undefined)        { sets.push(`cabine = $${idx++}`);           values.push(cabine || null); }
        if (bagagem !== undefined)       { sets.push(`bagagem = $${idx++}`);          values.push(bagagem || null); }
        if (tarifa !== undefined)        { sets.push(`tarifa = $${idx++}`);           values.push(parseFloat(tarifa) || 0); }
        if (taxaEmbarque !== undefined)  { sets.push(`"taxaEmbarque" = $${idx++}`);   values.push(parseFloat(taxaEmbarque) || 0); }
        if (horaPartida !== undefined)   { sets.push(`"horaPartida" = $${idx++}`);    values.push(horaPartida || null); }
        if (horaChegada !== undefined)   { sets.push(`"horaChegada" = $${idx++}`);    values.push(horaChegada || null); }
        if (trechos !== undefined)       { sets.push(`trechos = $${idx++}`);          values.push(trechos ? JSON.stringify(trechos) : null); }

        if (sets.length === 0) return res.status(400).json({ error: true, message: 'Nenhum campo para atualizar' });

        sets.push(`"updatedAt" = NOW()`);
        values.push(req.params.id);

        await pool.query(`UPDATE bilhetes SET ${sets.join(', ')} WHERE id = $${idx}`, values);

        const bilheteCompleto = await _getBilheteComRelacoes(req.params.id);
        res.json({ success: true, message: 'Bilhete atualizado', data: bilheteCompleto });
    } catch (error) {
        console.error('Erro ao atualizar bilhete:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * DELETE /api/bilhetes/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM bilhetes WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Bilhete excluído' });
    } catch (error) {
        console.error('Erro ao excluir bilhete:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

async function _getBilheteComRelacoes(id) {
    const { rows } = await pool.query(
        `SELECT b.*,
            c.id AS "clienteId_rel", c.nome AS "clienteNome", c.email AS "clienteEmail", c.telefone AS "clienteTelefone",
            f.id AS "fornecedorId_rel", f.nome AS "fornecedorNome", f.telegram AS "fornecedorTelegram", f.balcao AS "fornecedorBalcao"
         FROM bilhetes b
         LEFT JOIN clientes c ON c.id = b."clienteId"
         LEFT JOIN fornecedores f ON f.id = b."fornecedorId"
         WHERE b.id = $1`,
        [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    const b = { ...r };
    b.cliente    = r.clienteNome    ? { id: r['clienteId_rel'],    nome: r.clienteNome,    email: r.clienteEmail,    telefone: r.clienteTelefone }    : null;
    b.fornecedor = r.fornecedorNome ? { id: r['fornecedorId_rel'], nome: r.fornecedorNome, telegram: r.fornecedorTelegram, balcao: r.fornecedorBalcao } : null;
    delete b.clienteNome; delete b.clienteEmail; delete b.clienteTelefone;
    delete b.fornecedorNome; delete b.fornecedorTelegram; delete b.fornecedorBalcao;
    delete b['clienteId_rel']; delete b['fornecedorId_rel'];
    return b;
}

module.exports = router;
