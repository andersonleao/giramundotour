import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
const logs = [];
page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    else logs.push(msg.text());
});
page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

await page.goto('http://localhost:3000/login.html');
await page.evaluate(() => {
    localStorage.setItem('giramundo_token', 'fake-token');
    localStorage.setItem('giramundo_user', JSON.stringify({id:'1',nome:'Admin',email:'admin@test.com',perfil:'admin'}));
});

await page.goto('http://localhost:3000/index.html');
await page.waitForTimeout(1500);

// Usa data futura
await page.evaluate(() => {
    document.getElementById('origemCode').value = 'GRU';
    document.getElementById('origem').value = 'São Paulo (GRU)';
    document.getElementById('destinoCode').value = 'GIG';
    document.getElementById('destino').value = 'Rio de Janeiro (GIG)';
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + 37);
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('dataIda').value = fmt(futureDate);
    document.getElementById('dataVolta').value = fmt(returnDate);
});

await page.evaluate(() => SearchModule.executarBusca());
await page.waitForTimeout(3000);

// Verifica se modal abriu
const modalVisible = await page.evaluate(() => {
    const m = document.getElementById('modalVoos');
    return m ? m.classList.contains('show') : false;
});
console.log('Modal aberto:', modalVisible);

if (!modalVisible) {
    console.log('Modal NAO abriu. Verificando estado...');
    const state = await page.evaluate(() => ({
        resultados: SearchModule.resultados ? { ida: SearchModule.resultados.ida?.length, volta: SearchModule.resultados.volta?.length } : null,
        errors: document.querySelectorAll('.invalid-feedback').length
    }));
    console.log('State:', JSON.stringify(state));
    console.log('ERROS:', JSON.stringify(errors));
    await browser.close();
    process.exit(1);
}

// Seleciona ida
await page.locator('#modalVoos .btn-selecionar-voo').first().click();
await page.waitForTimeout(1500);

// Seleciona volta
const voltaModal = await page.evaluate(() => {
    const m = document.getElementById('modalVoos');
    return m ? m.classList.contains('show') : false;
});
console.log('Modal volta aberto:', voltaModal);

if (voltaModal) {
    await page.locator('#modalVoos .btn-selecionar-voo').first().click();
    await page.waitForTimeout(1500);
}

// Verifica resumo
const resumoVisible = await page.locator('#resumoSelecao').isVisible();
console.log('Resumo visivel:', resumoVisible);

// Clica Criar Cotação
const btnCot = page.locator('button:has-text("Criar Cotação")');
const btnCount = await btnCot.count();
console.log('Botoes Criar Cotacao:', btnCount);

if (btnCount > 0) {
    console.log('Clicando Criar Cotacao...');
    await btnCot.first().click();
    await page.waitForTimeout(2000);

    const finalState = await page.evaluate(() => {
        const cotacao = document.getElementById('page-cotacao');
        const busca = document.getElementById('page-busca');
        const content = document.getElementById('cotacaoContent');
        const allSections = document.querySelectorAll('.page-section.active');
        const activeSections = [];
        allSections.forEach(s => activeSections.push(s.id));
        return {
            activeSections,
            cotacaoActive: cotacao?.classList.contains('active'),
            buscaActive: busca?.classList.contains('active'),
            contentHTML: content?.innerHTML.substring(0, 1000) || 'EMPTY',
            contentEmpty: content?.innerHTML.trim() === '',
            hash: window.location.hash,
            cotacaoAtual: typeof QuotationModule !== 'undefined' ? {
                exists: !!QuotationModule.cotacaoAtual,
                voosCount: QuotationModule.cotacaoAtual?.voos?.length,
                precos: QuotationModule.cotacaoAtual?.precos
            } : 'QuotationModule not found'
        };
    });
    console.log('Final state:', JSON.stringify(finalState, null, 2));
} else {
    console.log('Botao Criar Cotacao NAO encontrado');
    const resumoHTML = await page.evaluate(() => document.getElementById('resumoSelecao')?.innerHTML.substring(0, 500));
    console.log('Resumo HTML:', resumoHTML);
}

console.log('\nERROS:', errors.length > 0 ? JSON.stringify(errors, null, 2) : 'Nenhum');

await browser.close();
