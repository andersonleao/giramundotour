/**
 * GiraMundoTour - Configuração do Banco de Dados (pg direto)
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Erro inesperado no pool PostgreSQL:', err);
});

async function connectDatabase() {
    try {
        const client = await pool.connect();
        client.release();
        console.log('✅ Conectado ao banco de dados PostgreSQL com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar ao banco de dados:', error);
        process.exit(1);
    }
}

async function disconnectDatabase() {
    await pool.end();
    console.log('🔌 Desconectado do banco de dados');
}

module.exports = {
    pool,
    connectDatabase,
    disconnectDatabase
};
