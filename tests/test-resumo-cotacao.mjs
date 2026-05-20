import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
    if (cond) { passed++; console.log(`  ✅ ${msg}`); }
    else { failed++; console.log(`  ❌ FALHOU: ${msg}`); }
}

console.log('\n=== TESTE: Formato Moeda + PDF sem preço por trecho ===\n');

// Login
await page.goto('http://localhost:3000/login.html');
await page.evaluate(() => {
    localStorage.setItem('giramundo_token', 'fake-token');
    localStorage.setItem('giramundo_user', JSON.stringify({id:'1',nome:'Admin',email:'admin@test.com',perfil:'admin'}));
});
await page.goto('http://localhost:3000/index.html');
await page.waitForTimeout(2000);

// Criar cotação
await page.evaluate(() => {
    QuotationModule.novaCotacao({
        voos: [
            { companhia: 'LA', companhiaNome: 'LATAM', companhiaCor: '#1B0088', numeroVoo: 'LA3456',
              origem: 'GRU', destino: 'GIG', dataPartida: '2026-03-15T08:00:00', dataChegada: '2026-03-15T09:15:00',
              duracao: 75, escalas: 0, classe: 'economica', preco: 450.00, tipo: 'ida' },
            { companhia: 'G3', companhiaNome: 'GOL', companhiaCor: '#FF6600', numeroVoo: 'G31234',
              origem: 'GIG', destino: 'GRU', dataPartida: '2026-03-22T18:00:00', dataChegada: '2026-03-22T19:15:00',
              duracao: 75, escalas: 0, classe: 'economica', preco: 380.00, tipo: 'volta' }
        ],
        passageiros: { adultos: 2, criancas: 0, bebes: 0 }
    });
    App.navigate('cotacao');
});
await page.waitForTimeout(1500);

// ==========================================
// PARTE 1: INPUTS EM FORMATO MOEDA
// ==========================================
console.log('--- PARTE 1: Formato Moeda ---\n');

console.log('1. Inputs renderizados como moeda...');
const inputCheck = await page.evaluate(() => {
    const inputs = document.querySelectorAll('#cotacaoContent .quotation-edit-input');
    const results = [];
    inputs.forEach(input => {
        results.push({
            campo: input.dataset.campo,
            type: input.type,
            value: input.value,
            raw: input.dataset.raw,
            isFormatted: input.value.includes('R$'),
        });
    });
    return results;
});

assert(inputCheck.length === 3, `3 inputs encontrados (${inputCheck.length})`);
inputCheck.forEach(inp => {
    assert(inp.type === 'text', `${inp.campo}: type="text"`);
    assert(inp.isFormatted, `${inp.campo}: valor="${inp.value}" (formato moeda)`);
    assert(inp.raw != null, `${inp.campo}: data-raw="${inp.raw}"`);
});

// Focus: mostra numérico
console.log('\n2. Focus mostra valor numérico...');
const focusCheck = await page.evaluate(() => {
    const input = document.querySelector('.quotation-edit-input[data-campo="subtotalVoos"]');
    const valorAntes = input.value;
    QuotationModule.focusCampoMoeda(input);
    const valorFocus = input.value;
    // Restaura sem trigger blur
    input.value = valorAntes;
    return { valorAntes, valorFocus };
});

assert(focusCheck.valorAntes.includes('R$'), `Antes: "${focusCheck.valorAntes}" (moeda)`);
assert(!focusCheck.valorFocus.includes('R$'), `Focus: "${focusCheck.valorFocus}" (numérico)`);

// Blur: formata e salva (render recria inputs, verificar dados internos)
console.log('\n3. Blur formata e salva valor...');
const blurCheck = await page.evaluate(() => {
    const input = document.querySelector('.quotation-edit-input[data-campo="subtotalVoos"]');
    QuotationModule.focusCampoMoeda(input);
    input.value = '1500.50';
    QuotationModule.blurCampoMoeda(input);
    // Após render, pegar novo input
    const newInput = document.querySelector('.quotation-edit-input[data-campo="subtotalVoos"]');
    return {
        novoValor: newInput?.value,
        novoRaw: newInput?.dataset.raw,
        isFormatted: newInput?.value.includes('R$'),
        subtotalSalvo: QuotationModule.cotacaoAtual.valoresPersonalizados?.subtotalVoos,
        totalRecalculado: QuotationModule.cotacaoAtual.valoresPersonalizados?.total
    };
});

assert(blurCheck.isFormatted, `Após blur: "${blurCheck.novoValor}" (moeda)`);
assert(blurCheck.novoRaw === '1500.50', `data-raw: "${blurCheck.novoRaw}"`);
assert(blurCheck.subtotalSalvo === 1500.5, `Dados internos: subtotal=${blurCheck.subtotalSalvo}`);
assert(blurCheck.totalRecalculado != null, `Total recalculado: ${blurCheck.totalRecalculado}`);

// Valor inválido
console.log('\n4. Valor inválido restaura...');
await page.evaluate(() => QuotationModule.restaurarValorOriginal());
await page.waitForTimeout(500);

const invalidResult = await page.evaluate(() => {
    const input = document.querySelector('.quotation-edit-input[data-campo="taxaEmbarque"]');
    const valorOriginal = input.value;
    QuotationModule.focusCampoMoeda(input);
    input.value = 'abc';
    QuotationModule.blurCampoMoeda(input);
    return {
        valorApos: input.value,
        restaurou: input.value.includes('R$'),
        semAlteracao: !QuotationModule.cotacaoAtual.valoresPersonalizados
    };
});

assert(invalidResult.restaurou, `Inválido restaura moeda: "${invalidResult.valorApos}"`);
assert(invalidResult.semAlteracao, 'Não salvou valor inválido');

// Formato BR com vírgula
console.log('\n5. Formato brasileiro (vírgula decimal)...');
const brCheck = await page.evaluate(() => {
    const input = document.querySelector('.quotation-edit-input[data-campo="subtotalVoos"]');
    QuotationModule.focusCampoMoeda(input);
    input.value = '2.500,75';
    QuotationModule.blurCampoMoeda(input);
    const newInput = document.querySelector('.quotation-edit-input[data-campo="subtotalVoos"]');
    return {
        valor: newInput?.value,
        raw: newInput?.dataset.raw,
        salvo: QuotationModule.cotacaoAtual.valoresPersonalizados?.subtotalVoos
    };
});

assert(brCheck.salvo === 2500.75, `"2.500,75" -> ${brCheck.salvo} (esperado: 2500.75)`);
assert(brCheck.raw === '2500.75', `data-raw: "${brCheck.raw}"`);

// Formato EN com ponto
console.log('\n6. Formato inglês (ponto decimal)...');
const enCheck = await page.evaluate(() => {
    QuotationModule.restaurarValorOriginal();
    return true;
});
await page.waitForTimeout(300);

const enResult = await page.evaluate(() => {
    const input = document.querySelector('.quotation-edit-input[data-campo="subtotalVoos"]');
    QuotationModule.focusCampoMoeda(input);
    input.value = '3500.99';
    QuotationModule.blurCampoMoeda(input);
    return {
        salvo: QuotationModule.cotacaoAtual.valoresPersonalizados?.subtotalVoos
    };
});

assert(enResult.salvo === 3500.99, `"3500.99" -> ${enResult.salvo}`);

// Total editável em moeda
console.log('\n7. Total editável em moeda...');
await page.evaluate(() => QuotationModule.restaurarValorOriginal());
await page.waitForTimeout(300);

const totalCheck = await page.evaluate(() => {
    const input = document.querySelector('.quotation-edit-input[data-campo="total"]');
    const isTotal = input?.classList.contains('quotation-edit-total');
    QuotationModule.focusCampoMoeda(input);
    input.value = '5000';
    QuotationModule.blurCampoMoeda(input);
    const newInput = document.querySelector('.quotation-edit-input[data-campo="total"]');
    return {
        isTotal,
        valor: newInput?.value,
        salvo: QuotationModule.cotacaoAtual.valoresPersonalizados?.total
    };
});

assert(totalCheck.isTotal, 'Input total tem classe quotation-edit-total');
assert(totalCheck.salvo === 5000, `Total editado: ${totalCheck.salvo}`);
assert(totalCheck.valor?.includes('R$'), `Total formatado: "${totalCheck.valor}"`);

// ==========================================
// PARTE 2: PDF SEM PREÇO POR TRECHO
// ==========================================
console.log('\n--- PARTE 2: PDF sem preço por trecho ---\n');

console.log('8. Verificando PDF...');
const pdfCheck = await page.evaluate(() => {
    const fn = ReportModule.gerarCotacaoPDF.toString();
    return {
        hasVooPreco: fn.includes('voo.preco'),
        hasPorPessoa: fn.includes('por pessoa'),
        hasSubtotalVoos: fn.includes("'Subtotal Voos'"),
        hasTaxaEmbarque: fn.includes("'Taxa de Embarque'"),
        hasTOTAL: fn.includes("'TOTAL'"),
    };
});

assert(!pdfCheck.hasVooPreco, 'PDF NÃO tem voo.preco (preço por trecho removido)');
assert(!pdfCheck.hasPorPessoa, 'PDF NÃO tem "por pessoa"');
assert(pdfCheck.hasSubtotalVoos, 'PDF mantém Subtotal Voos no resumo financeiro');
assert(pdfCheck.hasTaxaEmbarque, 'PDF mantém Taxa de Embarque no resumo financeiro');
assert(pdfCheck.hasTOTAL, 'PDF mantém TOTAL no resumo financeiro');

// ==========================================
// RESULTADO
// ==========================================

console.log('\n\n=============================');
console.log(`  RESULTADO: ${passed} passou, ${failed} falhou (${passed + failed} total)`);
console.log('=============================');

if (errors.length > 0) {
    console.log('\n⚠️  Erros no console:');
    errors.forEach(e => console.log(`  - ${e}`));
}

console.log('');
await browser.close();
process.exit(failed > 0 ? 1 : 0);
