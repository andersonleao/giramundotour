/**
 * GiraMundoTour - Seed do Banco de Dados
 *
 * Popula o banco com dados iniciais
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed do banco de dados...');

    // =============================================
    // Criar usuário admin padrão
    // =============================================
    const senhaHash = await bcrypt.hash('admin123', 10);

    const admin = await prisma.usuario.upsert({
        where: { email: 'admin@giramundotour.com.br' },
        update: {},
        create: {
            nome: 'Administrador',
            email: 'admin@giramundotour.com.br',
            senha: senhaHash,
            perfil: 'admin'
        }
    });
    console.log('✅ Usuário admin criado:', admin.email);

    // Criar operador de exemplo
    const operador = await prisma.usuario.upsert({
        where: { email: 'operador@giramundotour.com.br' },
        update: {},
        create: {
            nome: 'Operador',
            email: 'operador@giramundotour.com.br',
            senha: await bcrypt.hash('operador123', 10),
            perfil: 'operador'
        }
    });
    console.log('✅ Usuário operador criado:', operador.email);

    // =============================================
    // Criar fornecedores de exemplo
    // =============================================
    const fornecedores = [
        { nome: 'Consolidadora Aérea BR', telegram: 'consolidadora_br', balcao: 'Balcão Central', telefone: '11999999999' },
        { nome: 'Voo Certo Turismo', telegram: 'voocerto', balcao: 'Loja 102', telefone: '11988888888' },
        { nome: 'Air Tickets Global', telegram: 'airtickets', balcao: 'Online', telefone: '11977777777' },
        { nome: 'Passagens Express', telegram: 'passexpress', balcao: 'Terminal A', telefone: '11966666666' },
        { nome: 'Fly More Travel', telegram: 'flymore', balcao: 'Shopping Center', telefone: '11955555555' }
    ];

    for (const f of fornecedores) {
        await prisma.fornecedor.upsert({
            where: { id: f.nome.toLowerCase().replace(/\s/g, '-') },
            update: {},
            create: f
        });
    }
    console.log('✅ Fornecedores criados:', fornecedores.length);

    // =============================================
    // Criar clientes de exemplo
    // =============================================
    const clientes = [
        { nome: 'João Silva', email: 'joao.silva@email.com', telefone: '11999001001', cpf: '12345678901' },
        { nome: 'Maria Santos', email: 'maria.santos@email.com', telefone: '11999002002', cpf: '23456789012' },
        { nome: 'Pedro Oliveira', email: 'pedro.oliveira@email.com', telefone: '11999003003', cpf: '34567890123' },
        { nome: 'Ana Costa', email: 'ana.costa@email.com', telefone: '11999004004', cpf: '45678901234' },
        { nome: 'Carlos Ferreira', email: 'carlos.ferreira@email.com', telefone: '11999005005', cpf: '56789012345' }
    ];

    for (const c of clientes) {
        await prisma.cliente.upsert({
            where: { cpf: c.cpf },
            update: {},
            create: c
        });
    }
    console.log('✅ Clientes criados:', clientes.length);

    // =============================================
    // Criar companhias aéreas
    // =============================================
    const companhias = [
        { codigo: 'LA', nome: 'LATAM Airlines', cor: '#1B0088' },
        { codigo: 'G3', nome: 'GOL Linhas Aéreas', cor: '#FF6600' },
        { codigo: 'AD', nome: 'Azul Linhas Aéreas', cor: '#0033A0' },
        { codigo: 'AA', nome: 'American Airlines', cor: '#0078D2' },
        { codigo: 'UA', nome: 'United Airlines', cor: '#002244' },
        { codigo: 'DL', nome: 'Delta Air Lines', cor: '#003366' },
        { codigo: 'TP', nome: 'TAP Portugal', cor: '#00A651' },
        { codigo: 'IB', nome: 'Iberia', cor: '#DA291C' },
        { codigo: 'AF', nome: 'Air France', cor: '#002157' },
        { codigo: 'LH', nome: 'Lufthansa', cor: '#05164D' }
    ];

    for (const c of companhias) {
        await prisma.companhiaAerea.upsert({
            where: { codigo: c.codigo },
            update: {},
            create: c
        });
    }
    console.log('✅ Companhias aéreas criadas:', companhias.length);

    // =============================================
    // Criar configurações padrão
    // =============================================
    const configuracoes = [
        { chave: 'taxa_servico', valor: '50', tipo: 'number', descricao: 'Taxa de serviço por passageiro' },
        { chave: 'taxa_embarque', valor: '52.05', tipo: 'number', descricao: 'Taxa de embarque média' },
        { chave: 'markup', valor: '0.05', tipo: 'number', descricao: 'Margem de lucro (5%)' },
        { chave: 'validade_cotacao', valor: '3', tipo: 'number', descricao: 'Dias de validade da cotação' },
        { chave: 'empresa_nome', valor: 'GiraMundoTour', tipo: 'string', descricao: 'Nome da empresa' },
        { chave: 'empresa_telefone', valor: '(11) 3000-0000', tipo: 'string', descricao: 'Telefone da empresa' },
        { chave: 'empresa_email', valor: 'contato@giramundotour.com.br', tipo: 'string', descricao: 'Email da empresa' }
    ];

    for (const c of configuracoes) {
        await prisma.configuracao.upsert({
            where: { chave: c.chave },
            update: {},
            create: c
        });
    }
    console.log('✅ Configurações criadas:', configuracoes.length);

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 Seed concluído com sucesso!                          ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  Usuários de acesso:                                     ║');
    console.log('║  • Admin: admin@giramundotour.com.br / admin123          ║');
    console.log('║  • Operador: operador@giramundotour.com.br / operador123 ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
}

main()
    .catch((e) => {
        console.error('❌ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
