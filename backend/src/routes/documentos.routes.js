const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Cria a tabela na primeira execução.
// O conteúdo do arquivo é guardado em BYTEA (banco Neon) para sobreviver a
// redeploys — o disco do Render é efêmero e perderia arquivos gravados nele.
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS documentos (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                nome         VARCHAR(255) NOT NULL,
                descricao    TEXT,
                categoria    VARCHAR(100),
                tipo         VARCHAR(20),
                "mimeType"   VARCHAR(150),
                tamanho      INTEGER DEFAULT 0,
                conteudo     BYTEA NOT NULL,
                "uploadedBy" VARCHAR(255),
                "createdAt"  TIMESTAMP DEFAULT NOW()
            )
        `);
    } catch (err) {
        console.error('[documentos] erro ao criar tabela:', err.message);
    }
})();

// Deduz o tipo (pdf / word) a partir do mime ou da extensão do arquivo
function detectarTipo(mime, nome) {
    const m = (mime || '').toLowerCase();
    const n = (nome || '').toLowerCase();
    if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
    if (m.includes('word') || m.includes('wordprocessing') ||
        n.endsWith('.doc') || n.endsWith('.docx')) return 'word';
    return 'outro';
}

// GET /api/documentos — lista apenas os metadados (sem o conteúdo binário)
router.get('/', async (req, res) => {
    try {
        const { categoria, tipo, q } = req.query;
        const vals = [];
        const where = [];
        if (categoria) { vals.push(categoria); where.push(`categoria = $${vals.length}`); }
        if (tipo)      { vals.push(tipo);      where.push(`tipo = $${vals.length}`); }
        if (q)         { vals.push(`%${q}%`);  where.push(`(nome ILIKE $${vals.length} OR descricao ILIKE $${vals.length})`); }
        const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const { rows } = await pool.query(
            `SELECT id, nome, descricao, categoria, tipo, "mimeType", tamanho, "uploadedBy", "createdAt"
             FROM documentos ${wc} ORDER BY "createdAt" DESC`,
            vals
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// GET /api/documentos/:id/download — devolve o arquivo para download
router.get('/:id/download', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT nome, "mimeType", conteudo FROM documentos WHERE id = $1`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: true, message: 'Documento não encontrado' });

        const doc = rows[0];
        const buffer = doc.conteudo; // pg devolve BYTEA como Buffer
        const filename = encodeURIComponent(doc.nome || 'documento');

        res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// POST /api/documentos — importa um novo arquivo (conteúdo em base64 no corpo)
router.post('/', async (req, res) => {
    try {
        const { nome, descricao, categoria, mimeType, conteudoBase64 } = req.body;

        if (!nome)            return res.status(400).json({ error: true, message: 'Informe o nome do documento' });
        if (!conteudoBase64)  return res.status(400).json({ error: true, message: 'Nenhum arquivo enviado' });

        // Aceita tanto "data:...;base64,XXXX" quanto só o base64 puro
        const base64 = String(conteudoBase64).includes(',')
            ? String(conteudoBase64).split(',').pop()
            : String(conteudoBase64);
        const buffer = Buffer.from(base64, 'base64');

        const tipo = detectarTipo(mimeType, nome);
        const uploadedBy = req.usuario?.nome || req.usuario?.email || null;

        const { rows } = await pool.query(
            `INSERT INTO documentos (nome, descricao, categoria, tipo, "mimeType", tamanho, conteudo, "uploadedBy")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING id, nome, descricao, categoria, tipo, "mimeType", tamanho, "uploadedBy", "createdAt"`,
            [nome, descricao || null, categoria || null, tipo, mimeType || null, buffer.length, buffer, uploadedBy]
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

// DELETE /api/documentos/:id
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`DELETE FROM documentos WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: true, message: 'Documento não encontrado' });
        res.json({ success: true, message: 'Documento removido' });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

module.exports = router;
