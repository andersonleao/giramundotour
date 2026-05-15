/**
 * GiraMundoTour - Rotas do Dashboard
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

/**
 * GET /api/dashboard/resumo
 */
router.get('/resumo', async (req, res) => {
    try {
        const agora = new Date();
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
        const inicioAno = new Date(agora.getFullYear(), 0, 1).toISOString();

        const [
            clientesRes, fornecedoresRes, bilhetesTotalRes,
            cotacoesTotalRes, bilhetesMesRes, bilhetesAnoRes, cotacoesPendentesRes
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM clientes WHERE ativo = true'),
            pool.query('SELECT COUNT(*) FROM fornecedores WHERE ativo = true'),
            pool.query('SELECT COUNT(*) FROM bilhetes'),
            pool.query('SELECT COUNT(*) FROM cotacoes'),
            pool.query(
                `SELECT COUNT(*) AS qtd, COALESCE(SUM("valorVenda"),0) AS vendas, COALESCE(SUM("valorCompra"),0) AS compras
                 FROM bilhetes WHERE "dataEmissao" >= $1`, [inicioMes]
            ),
            pool.query(
                `SELECT COALESCE(SUM("valorVenda"),0) AS vendas, COALESCE(SUM("valorCompra"),0) AS compras
                 FROM bilhetes WHERE "dataEmissao" >= $1`, [inicioAno]
            ),
            pool.query("SELECT COUNT(*) FROM cotacoes WHERE status = 'pendente'")
        ]);

        const bMes = bilhetesMesRes.rows[0];
        const bAno = bilhetesAnoRes.rows[0];

        res.json({
            success: true,
            data: {
                clientes: parseInt(clientesRes.rows[0].count),
                fornecedores: parseInt(fornecedoresRes.rows[0].count),
                bilhetes: {
                    total: parseInt(bilhetesTotalRes.rows[0].count),
                    mes: parseInt(bMes.qtd),
                    vendasMes: parseFloat(bMes.vendas),
                    comprasMes: parseFloat(bMes.compras),
                    lucroMes: parseFloat(bMes.vendas) - parseFloat(bMes.compras),
                    vendasAno: parseFloat(bAno.vendas),
                    comprasAno: parseFloat(bAno.compras),
                    lucroAno: parseFloat(bAno.vendas) - parseFloat(bAno.compras)
                },
                cotacoes: {
                    total: parseInt(cotacoesTotalRes.rows[0].count),
                    pendentes: parseInt(cotacoesPendentesRes.rows[0].count)
                }
            }
        });
    } catch (error) {
        console.error('Erro ao buscar resumo:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/dashboard/bilhetes-por-mes
 */
router.get('/bilhetes-por-mes', async (req, res) => {
    try {
        const { ano = new Date().getFullYear() } = req.query;

        const { rows } = await pool.query(
            `SELECT "dataEmissao", "valorVenda", "valorCompra" FROM bilhetes
             WHERE "dataEmissao" >= $1 AND "dataEmissao" < $2`,
            [new Date(`${ano}-01-01`), new Date(`${parseInt(ano) + 1}-01-01`)]
        );

        const meses = Array(12).fill(null).map((_, i) => ({
            mes: i + 1, quantidade: 0, vendas: 0, compras: 0, lucro: 0
        }));

        rows.forEach(b => {
            const mes = new Date(b.dataEmissao).getMonth();
            meses[mes].quantidade++;
            meses[mes].vendas  += parseFloat(b.valorVenda)  || 0;
            meses[mes].compras += parseFloat(b.valorCompra) || 0;
            meses[mes].lucro   += (parseFloat(b.valorVenda) || 0) - (parseFloat(b.valorCompra) || 0);
        });

        res.json({ success: true, data: meses });
    } catch (error) {
        console.error('Erro ao buscar bilhetes por mês:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/dashboard/companhias
 */
router.get('/companhias', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT companhia,
                COUNT(*) AS quantidade,
                COALESCE(SUM("valorVenda"),0) AS vendas,
                COALESCE(SUM("valorCompra"),0) AS compras
             FROM bilhetes
             GROUP BY companhia
             ORDER BY quantidade DESC
             LIMIT 10`
        );

        res.json({
            success: true,
            data: rows.map(b => ({
                companhia: b.companhia,
                quantidade: parseInt(b.quantidade),
                vendas: parseFloat(b.vendas),
                compras: parseFloat(b.compras),
                lucro: parseFloat(b.vendas) - parseFloat(b.compras)
            }))
        });
    } catch (error) {
        console.error('Erro ao buscar companhias:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/dashboard/fornecedores-ranking
 */
router.get('/fornecedores-ranking', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT f.id, f.nome,
                COUNT(b.id) AS bilhetes,
                COALESCE(SUM(b."valorVenda"),0) AS vendas,
                COALESCE(SUM(b."valorCompra"),0) AS compras
             FROM fornecedores f
             LEFT JOIN bilhetes b ON b."fornecedorId" = f.id
             WHERE f.ativo = true
             GROUP BY f.id, f.nome
             ORDER BY bilhetes DESC
             LIMIT 10`
        );

        res.json({
            success: true,
            data: rows.map(f => ({
                id: f.id, nome: f.nome,
                bilhetes: parseInt(f.bilhetes),
                vendas: parseFloat(f.vendas),
                compras: parseFloat(f.compras),
                lucro: parseFloat(f.vendas) - parseFloat(f.compras)
            }))
        });
    } catch (error) {
        console.error('Erro ao buscar ranking:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/dashboard/ultimos-bilhetes
 */
router.get('/ultimos-bilhetes', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT b.*, c.nome AS "clienteNome", f.nome AS "fornecedorNome"
             FROM bilhetes b
             LEFT JOIN clientes c ON c.id = b."clienteId"
             LEFT JOIN fornecedores f ON f.id = b."fornecedorId"
             ORDER BY b."dataEmissao" DESC LIMIT 10`
        );

        const bilhetes = rows.map(r => {
            const b = { ...r };
            b.cliente    = r.clienteNome    ? { nome: r.clienteNome }    : null;
            b.fornecedor = r.fornecedorNome ? { nome: r.fornecedorNome } : null;
            delete b.clienteNome; delete b.fornecedorNome;
            return b;
        });

        res.json({ success: true, data: bilhetes });
    } catch (error) {
        console.error('Erro ao buscar últimos bilhetes:', error);
        res.status(500).json({ error: true, message: 'Erro interno do servidor' });
    }
});

module.exports = router;
