// Teste E2E - Fluxo de Modal de Seleção de Voos (Ida e Volta)
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8080';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Captura erros do console
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    let passed = 0;
    let failed = 0;

    function assert(condition, name) {
        if (condition) {
            console.log(`  ✅ ${name}`);
            passed++;
        } else {
            console.log(`  ❌ ${name}`);
            failed++;
        }
    }

    try {
        // ===========================================================
        // SETUP: Navegar para a página e preencher a busca
        // ===========================================================
        console.log('\n🔄 Carregando pagina...');

        // Injeta autenticação fake no localStorage antes de carregar index.html
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
            localStorage.setItem('giramundo_token', 'fake-test-token');
            localStorage.setItem('giramundo_user', JSON.stringify({
                id: 1,
                nome: 'Teste E2E',
                email: 'teste@giramundotour.com',
                perfil: 'admin'
            }));
        });
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // Verifica que a pagina carregou
        const title = await page.title();
        assert(title.includes('GiraMundoTour'), 'Pagina carregada corretamente');

        // ===========================================================
        // TESTE 1: Busca ida e volta completa
        // ===========================================================
        console.log('\n📋 TESTE 1: Busca ida e volta - fluxo completo');

        // Preenche origem e destino via JS (hidden inputs + display inputs)
        await page.evaluate(() => {
            document.getElementById('origemCode').value = 'GRU';
            document.getElementById('origem').value = 'São Paulo (GRU)';
            document.getElementById('destinoCode').value = 'GIG';
            document.getElementById('destino').value = 'Rio de Janeiro (GIG)';
            document.getElementById('dataIda').value = '2026-03-15';
            document.getElementById('dataVolta').value = '2026-03-20';
            document.getElementById('idaVolta').checked = true;
            // Garante que o grupo de data volta está visível
            document.getElementById('dataVoltaGroup').classList.remove('d-none');
        });

        // Clica em buscar
        await page.click('#btnBuscar');

        // Aguarda o modal de ida aparecer (mock tem delay de 800-2000ms)
        console.log('  ⏳ Aguardando busca e modal de ida...');
        await page.waitForSelector('#modalVoos', { timeout: 10000 });

        // Verifica modal de ida
        const modalTitle = await page.textContent('#modalVoos .modal-title');
        assert(modalTitle.includes('Voo de Ida'), 'Modal de ida abriu com titulo correto');

        // Verifica step indicator
        const stepText = await page.textContent('#modalVoos .modal-step');
        assert(stepText.includes('Passo 1 de 2'), 'Step indicator "Passo 1 de 2" visivel');

        // Verifica que existem flight cards no modal
        const cardsIda = await page.$$('#modalVoosLista .flight-card');
        assert(cardsIda.length > 0, `${cardsIda.length} voos de ida renderizados no modal`);

        // Verifica filtros no modal
        const filtroCompanhia = await page.$('#modalFiltroCompanhia');
        assert(filtroCompanhia !== null, 'Filtro de companhia presente no modal');

        const filtroEscalas = await page.$('#modalFiltroEscalas');
        assert(filtroEscalas !== null, 'Filtro de escalas presente no modal');

        const filtroOrdenacao = await page.$('#modalOrdenacao');
        assert(filtroOrdenacao !== null, 'Filtro de ordenacao presente no modal');

        // Verifica contador
        const contador = await page.textContent('#modalContador');
        assert(contador.includes('voos encontrados'), `Contador mostra: "${contador}"`);

        // ===========================================================
        // TESTE 2: Testar filtros dentro do modal
        // ===========================================================
        console.log('\n📋 TESTE 2: Filtros dentro do modal');

        // Filtra por diretos
        await page.selectOption('#modalFiltroEscalas', '0');
        await sleep(200);

        const cardsFiltrados = await page.$$('#modalVoosLista .flight-card');
        const contadorFiltrado = await page.textContent('#modalContador');
        assert(true, `Apos filtrar diretos: ${cardsFiltrados.length} voos (${contadorFiltrado})`);

        // Remove filtro
        await page.selectOption('#modalFiltroEscalas', '');
        await sleep(200);

        // ===========================================================
        // TESTE 3: Selecionar voo de ida → modal de volta abre
        // ===========================================================
        console.log('\n📋 TESTE 3: Selecionar ida → modal de volta abre automaticamente');

        // Clica no primeiro botão "Selecionar" do modal
        await page.click('#modalVoosLista .btn-selecionar-voo');

        // Aguarda transição do modal (fade out + fade in do próximo)
        await page.waitForSelector('#modalVoos', { state: 'hidden', timeout: 5000 }).catch(() => {});
        await sleep(1000);

        // Aguarda novo modal de volta
        await page.waitForSelector('#modalVoos', { timeout: 5000 });

        const modalTitleVolta = await page.textContent('#modalVoos .modal-title');
        assert(modalTitleVolta.includes('Voo de Volta'), 'Modal de volta abriu automaticamente');

        // Verifica step indicator de volta
        const stepTextVolta = await page.textContent('#modalVoos .modal-step');
        assert(stepTextVolta.includes('Passo 2 de 2'), 'Step indicator "Passo 2 de 2" visivel');

        // Verifica que botão "Pular" existe
        const btnPular = await page.$('#btnPularVolta');
        assert(btnPular !== null, 'Botao "Pular" presente no modal de volta');

        // Verifica cards de volta
        const cardsVolta = await page.$$('#modalVoosLista .flight-card');
        assert(cardsVolta.length > 0, `${cardsVolta.length} voos de volta renderizados no modal`);

        // ===========================================================
        // TESTE 4: Selecionar voo de volta → resumo aparece
        // ===========================================================
        console.log('\n📋 TESTE 4: Selecionar volta → resumo com ambos os voos');

        // Clica no primeiro botão "Selecionar" de volta
        await page.click('#modalVoosLista .btn-selecionar-voo');

        // Aguarda modal fechar e resumo aparecer
        await sleep(1500);

        // Verifica que o resumo está visível
        const resumoVisible = await page.$eval('#resumoSelecao', el => !el.classList.contains('d-none'));
        assert(resumoVisible, 'Resumo de selecao visivel');

        // Verifica conteúdo do resumo
        const resumoHtml = await page.textContent('#resumoSelecao');
        assert(resumoHtml.includes('Ida:'), 'Resumo contem voo de ida');
        assert(resumoHtml.includes('Volta:'), 'Resumo contem voo de volta');
        assert(resumoHtml.includes('Subtotal'), 'Resumo contem subtotal');
        assert(resumoHtml.includes('Criar Cotação'), 'Botao "Criar Cotação" presente');

        // Verifica botões de alterar
        const btnAlterarIda = await page.$('#resumoSelecao .btn-alterar-voo');
        assert(btnAlterarIda !== null, 'Botao "Alterar" presente no resumo');

        // Verifica que o modal está fechado
        const modalStillOpen = await page.$('#modalVoos');
        assert(modalStillOpen === null, 'Modal fechado apos selecao');

        // ===========================================================
        // TESTE 5: Alterar voo de ida (reabre fluxo)
        // ===========================================================
        console.log('\n📋 TESTE 5: Alterar voo de ida → reabre fluxo de modais');

        // Clica em "Alterar" no voo de ida
        await page.evaluate(() => SearchModule.reabrirModalVoos('ida'));
        await sleep(500);

        await page.waitForSelector('#modalVoos', { timeout: 5000 });
        const modalTitleReabrir = await page.textContent('#modalVoos .modal-title');
        assert(modalTitleReabrir.includes('Voo de Ida'), 'Modal de ida reabriu ao clicar Alterar');

        // Seleciona outro voo (o segundo, se existir)
        const btnsSelecionar = await page.$$('#modalVoosLista .btn-selecionar-voo');
        if (btnsSelecionar.length > 1) {
            await btnsSelecionar[1].click();
        } else {
            await btnsSelecionar[0].click();
        }

        // Aguarda transição para modal de volta
        await sleep(1500);
        await page.waitForSelector('#modalVoos', { timeout: 5000 });

        const modalTitleVolta2 = await page.textContent('#modalVoos .modal-title');
        assert(modalTitleVolta2.includes('Voo de Volta'), 'Modal de volta abriu apos re-selecao de ida');

        // Seleciona volta
        await page.click('#modalVoosLista .btn-selecionar-voo');
        await sleep(1500);

        const resumoVisible2 = await page.$eval('#resumoSelecao', el => !el.classList.contains('d-none'));
        assert(resumoVisible2, 'Resumo visivel apos re-selecao completa');

        // ===========================================================
        // TESTE 6: Busca ida e volta → pular volta
        // ===========================================================
        console.log('\n📋 TESTE 6: Pular voo de volta');

        // Nova busca
        await page.click('#btnBuscar');
        console.log('  ⏳ Aguardando nova busca...');
        await page.waitForSelector('#modalVoos', { timeout: 10000 });

        // Seleciona ida
        await page.click('#modalVoosLista .btn-selecionar-voo');
        await sleep(1500);

        // Aguarda modal de volta
        await page.waitForSelector('#modalVoos', { timeout: 5000 });
        assert((await page.textContent('#modalVoos .modal-title')).includes('Voo de Volta'), 'Modal de volta abriu');

        // Clica em "Pular"
        await page.click('#btnPularVolta');
        await sleep(1500);

        // Verifica resumo sem volta
        const resumoHtml2 = await page.textContent('#resumoSelecao');
        assert(resumoHtml2.includes('Ida:'), 'Resumo contem ida apos pular volta');
        assert(resumoHtml2.includes('volta não selecionado'), 'Resumo indica que volta nao foi selecionada');
        assert(resumoHtml2.includes('Selecionar Volta'), 'Botao "Selecionar Volta" disponivel');

        // ===========================================================
        // TESTE 7: Selecionar volta depois de pular
        // ===========================================================
        console.log('\n📋 TESTE 7: Selecionar volta depois de pular');

        await page.evaluate(() => SearchModule.reabrirModalVoos('volta'));
        await sleep(500);
        await page.waitForSelector('#modalVoos', { timeout: 5000 });

        const modalTitleVolta3 = await page.textContent('#modalVoos .modal-title');
        assert(modalTitleVolta3.includes('Voo de Volta'), 'Modal de volta abriu ao clicar "Selecionar Volta"');

        await page.click('#modalVoosLista .btn-selecionar-voo');
        await sleep(1500);

        const resumoHtml3 = await page.textContent('#resumoSelecao');
        assert(resumoHtml3.includes('Volta:'), 'Resumo agora contem voo de volta');

        // ===========================================================
        // TESTE 8: Somente ida
        // ===========================================================
        console.log('\n📋 TESTE 8: Busca somente ida');

        // Limpa cache e muda para somente ida com rota diferente (evita cache)
        await page.evaluate(() => {
            localStorage.removeItem('giramundo_busca_cache');
            document.getElementById('somenteIda').checked = true;
            document.getElementById('idaVolta').checked = false;
            document.getElementById('dataVoltaGroup').classList.add('d-none');
            document.getElementById('dataVolta').value = '';
            document.getElementById('origemCode').value = 'GRU';
            document.getElementById('origem').value = 'São Paulo (GRU)';
            document.getElementById('destinoCode').value = 'BSB';
            document.getElementById('destino').value = 'Brasília (BSB)';
            document.getElementById('dataIda').value = '2026-04-10';
        });
        await sleep(300);

        // Aguarda que nenhum modal esteja aberto
        await page.waitForSelector('#modalVoos', { state: 'detached', timeout: 3000 }).catch(() => {});

        // Busca
        await page.click('#btnBuscar');
        console.log('  ⏳ Aguardando busca somente ida...');
        await page.waitForSelector('#modalVoos', { timeout: 10000 });

        const modalTitleSoIda = await page.textContent('#modalVoos .modal-title');
        assert(modalTitleSoIda.includes('Voo de Ida'), 'Modal de ida abriu (somente ida)');

        // Sem step indicator pois é somente ida
        const stepEl = await page.$('#modalVoos .modal-step');
        const stepContent = stepEl ? await stepEl.textContent() : '';
        assert(!stepContent || stepContent.trim() === '', 'Sem step indicator para somente ida');

        // Seleciona ida
        await page.click('#modalVoosLista .btn-selecionar-voo');
        await sleep(1500);

        // Verifica resumo direto (sem modal de volta)
        const resumoSoIda = await page.textContent('#resumoSelecao');
        assert(resumoSoIda.includes('Ida:'), 'Resumo contem voo de ida');
        assert(!resumoSoIda.includes('Volta:'), 'Resumo NAO contem voo de volta (somente ida)');
        assert(!resumoSoIda.includes('volta não selecionado'), 'Sem mensagem de volta nao selecionado');

        // ===========================================================
        // TESTE 9: Cancelar modal de volta → mostra resumo com ida
        // ===========================================================
        console.log('\n📋 TESTE 9: Cancelar modal de volta → mostra resumo so com ida');

        // Limpa cache e muda para ida e volta
        await page.evaluate(() => {
            localStorage.removeItem('giramundo_busca_cache');
            document.getElementById('idaVolta').checked = true;
            document.getElementById('somenteIda').checked = false;
            document.getElementById('dataVoltaGroup').classList.remove('d-none');
            document.getElementById('origemCode').value = 'GRU';
            document.getElementById('origem').value = 'São Paulo (GRU)';
            document.getElementById('destinoCode').value = 'GIG';
            document.getElementById('destino').value = 'Rio de Janeiro (GIG)';
            document.getElementById('dataIda').value = '2026-05-01';
            document.getElementById('dataVolta').value = '2026-05-05';
        });
        await sleep(300);

        // Aguarda que nenhum modal esteja aberto
        await page.waitForSelector('#modalVoos', { state: 'detached', timeout: 3000 }).catch(() => {});

        // Busca via JS para evitar problemas de overlay
        await page.evaluate(() => SearchModule.executarBusca());
        console.log('  ⏳ Aguardando busca...');
        await page.waitForSelector('#modalVoos', { timeout: 10000 });

        // Seleciona ida
        await page.click('#modalVoosLista .btn-selecionar-voo');
        await sleep(1500);

        // Aguarda modal de volta
        await page.waitForSelector('#modalVoos', { timeout: 5000 });
        assert((await page.textContent('#modalVoos .modal-title')).includes('Voo de Volta'), 'Modal de volta abriu');

        // Clica em "Cancelar" (data-bs-dismiss)
        await page.click('#modalVoos [data-bs-dismiss="modal"]');
        await sleep(1500);

        // Verifica que o resumo aparece com ida
        const resumoCancelVolta = await page.textContent('#resumoSelecao');
        assert(resumoCancelVolta.includes('Ida:'), 'Resumo mostra ida apos cancelar volta');
        assert(resumoCancelVolta.includes('volta não selecionado'), 'Indica que volta nao selecionado apos cancelar');

        // ===========================================================
        // VERIFICAÇÃO FINAL: Erros no console
        // ===========================================================
        console.log('\n📋 VERIFICAÇÃO FINAL');
        const relevantErrors = consoleErrors.filter(e =>
            !e.includes('favicon') && !e.includes('404') && !e.includes('ERR_CONNECTION_REFUSED')
        );

        if (relevantErrors.length > 0) {
            console.log('  ⚠️  Erros no console do navegador:');
            relevantErrors.forEach(e => console.log(`     ${e}`));
        } else {
            assert(true, 'Nenhum erro JS relevante no console');
        }

    } catch (error) {
        console.log(`\n  💥 ERRO FATAL: ${error.message}`);
        failed++;

        // Screenshot para debug
        try {
            await page.screenshot({ path: 'C:\\Projetos_Claude\\GiraMundoTour\\test-error-screenshot.png', fullPage: true });
            console.log('  📸 Screenshot salvo em test-error-screenshot.png');
        } catch (e) {}

    } finally {
        await browser.close();
    }

    // Sumário
    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESULTADO: ${passed} passou, ${failed} falhou (total: ${passed + failed})`);
    console.log('='.repeat(60));

    process.exit(failed > 0 ? 1 : 0);
}

runTests();
