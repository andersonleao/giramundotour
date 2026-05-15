/**
 * GiraMundoTour - Reset de Senha
 * Uso: node reset-senha.js <email> <nova-senha>
 * Exemplo: node reset-senha.js giramundotourag@gmail.com minhasenha123
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const [,, email, senha] = process.argv;

if (!email || !senha) {
    console.error('Uso: node reset-senha.js <email> <nova-senha>');
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    try {
        // Verifica se usuário existe
        const { rows } = await pool.query('SELECT id, nome, email, ativo FROM usuarios WHERE email = $1', [email.toLowerCase()]);

        if (rows.length === 0) {
            console.error(`❌ Usuário não encontrado: ${email}`);
            process.exit(1);
        }

        const usuario = rows[0];
        const hash = await bcrypt.hash(senha, 10);

        await pool.query(
            'UPDATE usuarios SET senha = $1, ativo = true, "updatedAt" = NOW() WHERE email = $2',
            [hash, email.toLowerCase()]
        );

        console.log(`✅ Senha redefinida com sucesso!`);
        console.log(`   Nome:  ${usuario.nome}`);
        console.log(`   Email: ${usuario.email}`);
        console.log(`   Ativo: true`);
    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await pool.end();
    }
})();
