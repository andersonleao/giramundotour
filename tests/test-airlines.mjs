/**
 * test-airlines.mjs
 * Testa a API /api/airlines/consultar para Azul, GOL e LATAM.
 *
 * Uso:
 *   node tests/test-airlines.mjs
 *
 * Requer o servidor rodando em localhost:3000.
 * Ajuste BASE_URL, EMAIL, SENHA e os localizadores abaixo.
 */

const BASE_URL  = 'http://localhost:3000';
const EMAIL     = 'anderson@giramundo.com';    // ajuste se necessário
const SENHA     = 'admin123';                  // ajuste se necessário

// ─── Casos de teste ───────────────────────────────────────────────────────────
// Substitua pelos localizadores reais para validar dados
const CASOS = [
    { cia: 'azul',  localizador: 'VR6C3H', origem: 'SSA',  sobrenome: '',       descricao: 'Azul VR6C3H (SSA)' },
    { cia: 'gol',   localizador: 'ABCD12', origem: 'GRU',  sobrenome: 'SILVA',  descricao: 'GOL ABCD12 (GRU) — exemplo' },
    { cia: 'latam', localizador: '123456789', origem: '',   sobrenome: 'SANTOS', descricao: 'LATAM 123456789 — exemplo' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login() {
    const r = await fetch(`${BASE_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: EMAIL, senha: SENHA }),
    });
    if (!r.ok) throw new Error(`Login falhou: HTTP ${r.status}`);
    const json = await r.json();
    if (!json.token) throw new Error('Login: token não retornado. Resposta: ' + JSON.stringify(json));
    return json.token;
}

async function consultarReserva(token, { cia, localizador, origem, sobrenome }) {
    const r = await fetch(`${BASE_URL}/api/airlines/consultar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ cia, localizador, origem, sobrenome }),
    });
    const json = await r.json();
    return { httpStatus: r.status, ...json };
}

function formatar(resultado) {
    if (!resultado.success) {
        const motivo = resultado.blocked ? '🔒 BLOQUEADO' : '❌ ERRO';
        return `${motivo} — ${resultado.message || ''}`;
    }
    return [
        `✅ OK (${resultado.fonte})`,
        `   Origem  : ${resultado.origem}`,
        `   Destino : ${resultado.destino}`,
        `   Data Ida: ${resultado.dataIda}   Volta: ${resultado.dataVolta || '(s/ volta)'}`,
        `   Hora    : ${resultado.horaPartida || '-'}   Voo: ${resultado.voo || '-'}`,
        `   Passageiro: ${resultado.passageiroNome || '-'}`,
    ].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════');
console.log(' GiraMundoTour — Teste da API de Companhias Aéreas ');
console.log('═══════════════════════════════════════════════════\n');

let token;
try {
    process.stdout.write('🔑 Fazendo login... ');
    token = await login();
    console.log('OK\n');
} catch (err) {
    console.error('FALHA no login:', err.message);
    console.log('\nVerifique se o servidor está rodando (npm run dev) e as credenciais em EMAIL/SENHA.\n');
    process.exit(1);
}

let passou = 0, falhou = 0;

for (const caso of CASOS) {
    console.log(`─── ${caso.descricao} ${'─'.repeat(Math.max(0, 45 - caso.descricao.length))}`);
    console.log(`    Request: cia=${caso.cia} loc=${caso.localizador} origem=${caso.origem || '-'} sobrenome=${caso.sobrenome || '-'}`);

    const inicio = Date.now();
    try {
        const resultado = await consultarReserva(token, caso);
        const ms = Date.now() - inicio;
        console.log(`    Tempo  : ${ms}ms`);
        console.log(`    ${formatar(resultado)}`);

        if (resultado.success) passou++;
        else if (resultado.blocked) {
            console.log('    ℹ️  Bloqueado pelo servidor da companhia (esperado em datacenter Render).');
            falhou++;
        } else {
            falhou++;
        }
    } catch (err) {
        console.error(`    💥 Erro inesperado: ${err.message}`);
        falhou++;
    }
    console.log();
}

console.log('═══════════════════════════════════════════════════');
console.log(` Resultado: ${passou} OK / ${falhou} bloqueados ou com erro`);
console.log('═══════════════════════════════════════════════════\n');

console.log('ℹ️  Observações:');
console.log('  • "BLOQUEADO" indica bot-protection ativa no IP do servidor (esperado no Render).');
console.log('  • "OK" indica que a API da companhia respondeu com dados válidos.');
console.log('  • Para Azul/GOL: substitua os localizadores por reservas reais para validar o parser.');
