// GiraMundoTour - Módulo de Reservas

const ReservasModule = {

    _sortCol: 'dataIda',
    _sortDir: 'asc',

    _currentPage: 1,
    _pageSize: 10,

    // Reservas carregadas do banco de dados
    _dbReservas: [],

    // Caches de clientes e fornecedores (PostgreSQL)
    _clientes: [],
    _fornecedores: [],

    // =====================
    // INICIALIZAÇÃO
    // =====================

    init() {
        debugLog('ReservasModule: Inicializado');
    },

    // =====================
    // RENDER
    // =====================

    render() {
        const container = document.getElementById('reservasContent');
        if (!container) return;

        // Reseta caches para recarregar dados frescos do banco a cada visita
        this._dbReservas    = [];
        this._clientes      = [];
        this._fornecedores  = [];

        // Reseta paginação para a primeira página em cada entrada na tela
        this._currentPage = 1;

        const optsAeroportos = this._gerarOpcoesAeroportosBR();

        container.innerHTML = `
            <!-- Seleção de Companhia -->
            <div class="card mb-4">
                <div class="card-header">
                    <h5 class="mb-0"><i class="bi bi-airplane"></i> Nova Reserva</h5>
                </div>
                <div class="card-body">

                    <!-- LINHA 1: Seleção da companhia -->
                    <div class="row g-3 align-items-center mb-3">
                        <div class="col-12">
                            <label class="form-label fw-bold">Companhia Aérea</label>
                            <div class="d-flex gap-4 flex-wrap">
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="companhiaReserva" id="ciaAzul" value="azul"
                                           onchange="ReservasModule.onCompanhiaSelect('azul')">
                                    <label class="form-check-label" for="ciaAzul">
                                        <img src="https://pics.avs.io/200/200/AD.png" alt="Azul" style="height:24px; vertical-align:middle; margin-right:4px;">
                                        Azul
                                    </label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="companhiaReserva" id="ciaGol" value="gol"
                                           onchange="ReservasModule.onCompanhiaSelect('gol')">
                                    <label class="form-check-label" for="ciaGol">
                                        <img src="https://pics.avs.io/200/200/G3.png" alt="VoeGOL" style="height:24px; vertical-align:middle; margin-right:4px;">
                                        VoeGOL
                                    </label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="companhiaReserva" id="ciaLatam" value="latam"
                                           onchange="ReservasModule.onCompanhiaSelect('latam')">
                                    <label class="form-check-label" for="ciaLatam">
                                        <img src="https://pics.avs.io/200/200/LA.png" alt="LATAM" style="height:24px; vertical-align:middle; margin-right:4px;">
                                        LATAM
                                    </label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="companhiaReserva" id="ciaTap" value="tap"
                                           onchange="ReservasModule.onCompanhiaSelect('tap')">
                                    <label class="form-check-label" for="ciaTap">
                                        <img src="https://pics.avs.io/200/200/TP.png" alt="TAP" style="height:24px; vertical-align:middle; margin-right:4px;">
                                        TAP Air Portugal
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Campos por companhia -->
                    <div id="camposReserva" class="mt-3" style="display:none;">

                        <!-- Campo compartilhado: Emitido por -->
                        <div class="row g-3 mb-3">
                            <div class="col-md-4">
                                <label class="form-label fw-semibold">Emitido por</label>
                                <select class="form-select" id="reservaEmitidoPor">
                                    <option value="">Selecione...</option>
                                    <option value="Anderson">Anderson</option>
                                    <option value="Gabriela">Gabriela</option>
                                </select>
                            </div>
                        </div>

                        <!-- Azul: localizador + origem — busca automática, modal de complemento se bloqueado -->
                        <div id="camposAzul" style="display:none;">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-4">
                                    <label class="form-label">Localizador <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control text-uppercase" id="azulLocalizador"
                                           placeholder="Ex: VR6C3H" maxlength="10">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Origem <span class="text-danger">*</span></label>
                                    <select class="form-select" id="azulOrigem">
                                        <option value="">Selecione...</option>
                                        ${optsAeroportos}
                                    </select>
                                </div>
                                <div class="col-md-4 d-flex align-items-end">
                                    <button class="btn btn-success w-100" id="btnAzulAdicionar"
                                            onclick="ReservasModule.adicionarReserva()">
                                        <i class="bi bi-cloud-download"></i> Importar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Modal complemento Azul (aparece quando busca automática falha) -->
                        <div class="modal fade" id="modalComplementoAzul" tabindex="-1" aria-hidden="true">
                            <div class="modal-dialog modal-dialog-centered">
                                <div class="modal-content">
                                    <div class="modal-header bg-primary text-white py-2">
                                        <h6 class="modal-title mb-0">
                                            <i class="bi bi-airplane"></i> Complementar dados — Azul
                                        </h6>
                                    </div>
                                    <div class="modal-body">
                                        <p class="text-muted small mb-3">
                                            Localizador: <strong id="azulModalLoc"></strong> &nbsp;|&nbsp;
                                            Origem: <strong id="azulModalOri"></strong>
                                        </p>
                                        <div class="row g-3">
                                            <div class="col-md-12">
                                                <label class="form-label fw-semibold">Destino <span class="text-danger">*</span></label>
                                                <select class="form-select" id="azulModalDestino">
                                                    <option value="">Selecione...</option>
                                                    ${optsAeroportos}
                                                </select>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-semibold">Data de Ida <span class="text-danger">*</span></label>
                                                <input type="date" class="form-control" id="azulModalDataIda">
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-semibold">Data de Volta</label>
                                                <input type="date" class="form-control" id="azulModalDataVolta">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="modal-footer py-2">
                                        <button type="button" class="btn btn-secondary btn-sm"
                                                data-bs-dismiss="modal">Cancelar</button>
                                        <button type="button" class="btn btn-primary btn-sm"
                                                onclick="ReservasModule._salvarComplementoAzul()">
                                            <i class="bi bi-check-circle"></i> Salvar reserva
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- VoeGOL: dados manuais (sem Puppeteer) -->
                        <!-- GOL: localizador + sobrenome + origem — busca automática via Puppeteer -->
                        <div id="camposGol" style="display:none;">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-3">
                                    <label class="form-label">Localizador <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control text-uppercase" id="golLocalizador"
                                           placeholder="Ex: SEOBQV" maxlength="10">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Sobrenome <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control text-uppercase" id="golSobrenome"
                                           placeholder="Ex: SILVA">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Origem <span class="text-danger">*</span></label>
                                    <select class="form-select" id="golOrigem">
                                        <option value="">Selecione...</option>
                                        ${optsAeroportos}
                                    </select>
                                </div>
                                <div class="col-md-3 d-flex align-items-end">
                                    <button class="btn btn-success w-100" id="btnGolImportar"
                                            onclick="ReservasModule.adicionarReserva()">
                                        <i class="bi bi-cloud-download"></i> Importar
                                    </button>
                                </div>
                            </div>
                            <hr class="my-2">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-9">
                                    <label class="form-label text-muted">Ou importe o PDF de confirmação do e-mail GOL</label>
                                    <input type="file" class="form-control" id="golPdfInput" accept=".pdf">
                                </div>
                                <div class="col-md-3">
                                    <button class="btn btn-outline-success w-100" onclick="ReservasModule.importarPdfGol()">
                                        <i class="bi bi-file-earmark-arrow-up"></i> Importar PDF
                                    </button>
                                </div>
                            </div>
                        </div>


                        <!-- LATAM: Nº Compra + Sobrenome + Adicionar -->
                        <div id="camposLatam" style="display:none;">
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <label class="form-label">Número da Compra (Order ID)</label>
                                    <input type="text" class="form-control" id="latamNumeroPedido"
                                           placeholder="Ex: 123456789">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Sobrenome do Passageiro</label>
                                    <input type="text" class="form-control" id="latamSobrenome" placeholder="Sobrenome">
                                </div>
                                <div class="col-md-4 d-flex align-items-end">
                                    <button class="btn btn-success w-100" onclick="ReservasModule.adicionarReserva()">
                                        <i class="bi bi-plus-circle"></i> Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- TAP: Localizador + Sobrenome -->
                        <div id="camposTap" style="display:none;">
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <label class="form-label">Localizador</label>
                                    <input type="text" class="form-control text-uppercase" id="tapLocalizador"
                                           placeholder="Ex: XQWPGW" maxlength="10">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Sobrenome do Passageiro</label>
                                    <input type="text" class="form-control text-uppercase" id="tapSobrenome"
                                           placeholder="Ex: SILVA">
                                </div>
                                <div class="col-md-4 d-flex align-items-end">
                                    <button class="btn btn-success w-100" onclick="ReservasModule.adicionarReserva()">
                                        <i class="bi bi-plus-circle"></i> Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <!-- Grid de Reservas -->
            <div class="card">
                <div class="card-header">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                        <h5 class="mb-0"><i class="bi bi-list-ul"></i> Reservas</h5>
                        <button class="btn btn-primary btn-sm" onclick="ReservasModule.salvarNoBanco()" id="btnSalvarBanco">
                            <i class="bi bi-cloud-upload"></i> Salvar no Banco
                        </button>
                    </div>
                    <!-- Filtros -->
                    <div class="row g-2 align-items-end" id="reservasFiltros">
                        <div class="col-md-3">
                            <label class="form-label form-label-sm mb-1 text-muted">Código / Localizador</label>
                            <div class="input-group input-group-sm">
                                <span class="input-group-text"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control" id="reservasBusca"
                                       placeholder="Buscar por código..."
                                       oninput="ReservasModule.filtrarGrid()">
                            </div>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label form-label-sm mb-1 text-muted">Companhia</label>
                            <select class="form-select form-select-sm" id="reservasFiltroCompanhia"
                                    onchange="ReservasModule.filtrarGrid()">
                                <option value="">Todas</option>
                                <option value="azul">Azul</option>
                                <option value="gol">VoeGOL</option>
                                <option value="latam">LATAM</option>
                                <option value="tap">TAP Air Portugal</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label form-label-sm mb-1 text-muted">Cliente</label>
                            <select class="form-select form-select-sm" id="reservasFiltroCliente"
                                    onchange="ReservasModule.filtrarGrid()">
                                <option value="">Todos os clientes</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label form-label-sm mb-1 text-muted">Situação do Voo</label>
                            <select class="form-select form-select-sm" id="reservasFiltroSituacao"
                                    onchange="ReservasModule.filtrarGrid()">
                                <option value="">Todos os voos</option>
                                <option value="pendente" selected>Não realizados</option>
                                <option value="realizado">Já realizados</option>
                            </select>
                        </div>
                        <div class="col-md-1">
                            <button class="btn btn-outline-secondary btn-sm w-100" onclick="ReservasModule.limparFiltros()" title="Limpar filtros">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div id="reservasGrid">
                        <!-- Carregado por carregarGrid() -->
                        <div class="text-center text-muted py-5">
                            <div class="spinner-border spinner-border-sm" role="status"></div>
                            <span class="ms-2">Carregando reservas...</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Painel WhatsApp — Notificações de Check-in -->
            <div class="card mt-4">
                <div class="card-header d-flex align-items-center justify-content-between py-2">
                    <h6 class="mb-0">
                        <i class="bi bi-whatsapp text-success me-1"></i>
                        Notificações de Check-in via WhatsApp
                        <span class="text-muted fw-normal small ms-1">(gratuito)</span>
                    </h6>
                    <div id="wppStatusBadge">
                        <span class="badge bg-secondary"><i class="bi bi-circle-fill me-1" style="font-size:0.5rem;"></i>Verificando...</span>
                    </div>
                </div>
                <div class="card-body py-3" id="wppCardBody">
                    <div class="text-center text-muted py-2">
                        <div class="spinner-border spinner-border-sm" role="status"></div>
                        <span class="ms-2 small">Verificando status...</span>
                    </div>
                </div>
            </div>

            <!-- Modal QR Code WhatsApp -->
            <div class="modal fade" id="modalWppQR" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-sm modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white py-2">
                            <h6 class="modal-title mb-0">
                                <i class="bi bi-whatsapp me-1"></i> Conectar WhatsApp
                            </h6>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center py-3">
                            <p class="small text-muted mb-2">
                                Abra o WhatsApp no celular da agência →<br>
                                <strong>Dispositivos Vinculados → Vincular Dispositivo</strong>
                            </p>
                            <div id="wppQRContainer">
                                <div class="spinner-border text-success my-3" role="status"></div>
                                <p class="small text-muted">Gerando QR code...</p>
                            </div>
                            <p class="text-muted" style="font-size:0.7rem;">O QR expira em ~60s. Se expirar, feche e clique em Conectar novamente.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Teste WhatsApp -->
            <div class="modal fade" id="modalWppTeste" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header py-2">
                            <h6 class="modal-title"><i class="bi bi-whatsapp text-success me-1"></i> Enviar Mensagem de Teste</h6>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Número de celular (com DDD)</label>
                                <input type="tel" class="form-control" id="wppTesteNumero" placeholder="Ex: 11987654321">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small fw-bold">Mensagem</label>
                                <textarea class="form-control" id="wppTesteTexto" rows="3"
                                    placeholder="Mensagem de teste...">Olá! Teste de notificação de check-in. ✈️ — GiraMundoTour</textarea>
                            </div>
                        </div>
                        <div class="modal-footer py-2">
                            <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                            <button class="btn btn-success btn-sm" onclick="ReservasModule.enviarTesteWpp()">
                                <i class="bi bi-send me-1"></i> Enviar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Loading overlay específico para captura -->
            <div id="reservasLoadingOverlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0;
                 background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center; flex-direction:column;">
                <div class="text-center text-white">
                    <div class="spinner-border spinner-border-lg mb-3" style="width:3rem;height:3rem;" role="status"></div>
                    <div class="fs-5">Buscando dados do voo...</div>
                    <div class="text-muted small mt-2">Aguarde, isso pode levar até 30 segundos</div>
                </div>
            </div>
        `;

        this._popularFiltroClientes();
        this.carregarGrid();
        this._atualizarPainelWpp();
    },

    // =====================
    // POPULAR FILTRO DE CLIENTES
    // =====================

    async _popularFiltroClientes() {
        const sel = document.getElementById('reservasFiltroCliente');
        if (!sel) return;
        if (this._clientes.length === 0) {
            const resp = await apiCall('/api/clientes');
            if (resp) {
                const result = await resp.json();
                this._clientes = result.data || [];
            }
        }
        this._clientes.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nome;
            sel.appendChild(opt);
        });
    },

    // =====================
    // SELEÇÃO DE COMPANHIA
    // =====================

    onCompanhiaSelect(cia) {
        document.getElementById('camposReserva').style.display = 'block';
        document.getElementById('camposAzul').style.display  = cia === 'azul'  ? 'block' : 'none';
        document.getElementById('camposGol').style.display   = cia === 'gol'   ? 'block' : 'none';
        document.getElementById('camposLatam').style.display = cia === 'latam' ? 'block' : 'none';
        document.getElementById('camposTap').style.display   = cia === 'tap'   ? 'block' : 'none';
    },

    // =====================
    // ADICIONAR RESERVA (busca dados e insere na grid)
    // =====================

    async adicionarReserva() {
        const cia = document.querySelector('input[name="companhiaReserva"]:checked')?.value;
        if (!cia) {
            App.showToast('Selecione uma companhia aérea', 'error');
            return;
        }

        let url = '';
        let dadosForm = { companhia: cia };

        if (cia === 'azul') {
            const localizador = document.getElementById('azulLocalizador').value.trim().toUpperCase();
            const origem      = document.getElementById('azulOrigem').value;
            if (!localizador || !origem) {
                App.showToast('Preencha Localizador e Origem', 'error');
                return;
            }
            // Desabilita botão e mostra progresso
            const btnAzul = document.getElementById('btnAzulAdicionar');
            if (btnAzul) { btnAzul.disabled = true; btnAzul.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Buscando...'; }

            // Tenta busca automática no backend
            let bilheteData = null;
            try {
                const resp = await fetch('/api/reservas/azul-lookup', {
                    method: 'POST', headers: this._authHeaders(),
                    body: JSON.stringify({ pnr: localizador, origin: origem })
                });
                const result = await resp.json();
                if (result.success && result.bilheteData?.ida?.data) {
                    bilheteData = result.bilheteData;
                }
            } catch (e) {
                console.warn('[Azul] Lookup falhou:', e.message);
            }

            if (btnAzul) { btnAzul.disabled = false; btnAzul.innerHTML = '<i class="bi bi-cloud-download"></i> Importar'; }

            const urlReserva  = `https://www.voeazul.com.br/br/pt/home/minhas-viagens/confirmacao?pnr=${localizador}&origin=${origem}`;
            const emitidoPor  = document.getElementById('reservaEmitidoPor')?.value || '';

            if (bilheteData) {
                // Busca automática OK — salva direto com todos os dados
                this._salvarReservaAzul(localizador, origem, urlReserva, emitidoPor, bilheteData);
            } else {
                // Busca bloqueada — abre modal para o usuário completar os 3 campos restantes
                document.getElementById('azulModalLoc').textContent = localizador;
                document.getElementById('azulModalOri').textContent = origem;
                document.getElementById('azulModalDestino').value  = '';
                document.getElementById('azulModalDataIda').value  = '';
                document.getElementById('azulModalDataVolta').value = '';
                // Armazena contexto no modal para uso no callback
                const modal = document.getElementById('modalComplementoAzul');
                modal.dataset.localizador = localizador;
                modal.dataset.origem      = origem;
                modal.dataset.urlReserva  = urlReserva;
                modal.dataset.emitidoPor  = emitidoPor;
                new bootstrap.Modal(modal).show();
            }
            return;

        } else if (cia === 'gol') {
            const localizador = document.getElementById('golLocalizador').value.trim().toUpperCase();
            const sobrenome   = document.getElementById('golSobrenome').value.trim().toUpperCase();
            const origem      = document.getElementById('golOrigem').value;
            if (!localizador || !sobrenome || !origem) {
                App.showToast('Preencha Localizador, Sobrenome e Origem', 'error');
                return;
            }

            const btnGol = document.getElementById('btnGolImportar');
            const setBtn = (txt, disabled) => { if (btnGol) { btnGol.disabled = disabled; btnGol.innerHTML = txt; } };
            setBtn('<span class="spinner-border spinner-border-sm me-1"></span> Buscando...', true);

            const urlReserva = `https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem?codigoReserva=${localizador}&origem=${origem}&sobrenome=${encodeURIComponent(sobrenome.toLowerCase())}`;
            const emitidoPor = document.getElementById('reservaEmitidoPor')?.value || '';

            try {
                // 1. Inicia job (resposta imediata com jobId)
                const startResp = await fetch('/api/reservas/gol-lookup', {
                    method: 'POST', headers: this._authHeaders(),
                    body: JSON.stringify({ pnr: localizador, origin: origem, lastName: sobrenome })
                });
                const startData = await startResp.json();
                if (!startData.success || !startData.jobId) throw new Error(startData.message || 'Falha ao iniciar lookup');

                // 2. Polling a cada 2s por até 60s
                const jobId = startData.jobId;
                let bilheteData = null;
                let tentativas  = 0;
                const maxTentativas = 30; // 30 × 2s = 60s

                while (tentativas < maxTentativas) {
                    await new Promise(r => setTimeout(r, 2000));
                    tentativas++;
                    try {
                        const pollResp = await fetch(`/api/reservas/gol-status/${jobId}`, { headers: this._authHeaders() });
                        const poll     = await pollResp.json();
                        if (poll.status === 'done') {
                            bilheteData = poll.bilheteData;
                            break;
                        }
                        if (poll.status === 'failed') {
                            setBtn('<i class="bi bi-cloud-download"></i> Importar', false);
                            App.showToast('GOL: ' + (poll.error || 'Falha na importação'), 'error');
                            return;
                        }
                    } catch (e) { /* polling pode falhar temporariamente */ }
                }

                if (!bilheteData) {
                    setBtn('<i class="bi bi-cloud-download"></i> Importar', false);
                    App.showToast('GOL: timeout ao buscar dados. Tente novamente.', 'error');
                    return;
                }

                setBtn('<i class="bi bi-cloud-download"></i> Importar', false);
                this._salvarReservaGol(localizador, sobrenome, origem, urlReserva, emitidoPor, bilheteData);

            } catch (e) {
                console.warn('[GOL] Erro:', e.message);
                setBtn('<i class="bi bi-cloud-download"></i> Importar', false);
                App.showToast('Erro ao importar GOL: ' + e.message, 'error');
            }
            return;

        } else if (cia === 'latam') {
            const numeroPedido = document.getElementById('latamNumeroPedido').value.trim();
            const sobrenome    = document.getElementById('latamSobrenome').value.trim();
            if (!numeroPedido || !sobrenome) {
                App.showToast('Preencha o Número da Compra e Sobrenome', 'error');
                return;
            }
            url = `https://www.latamairlines.com/br/pt/minhas-viagens/second-detail/?orderId=${numeroPedido}&lastname=${encodeURIComponent(sobrenome)}`;
            dadosForm = { ...dadosForm, numeroPedido, sobrenome };

        } else if (cia === 'tap') {
            const localizador = document.getElementById('tapLocalizador').value.trim().toUpperCase();
            const sobrenome   = document.getElementById('tapSobrenome').value.trim().toUpperCase().replace(/\s+/g, '');
            if (!localizador || !sobrenome) {
                App.showToast('Preencha o Localizador e o Sobrenome', 'error');
                return;
            }
            url = `https://myb.flytap.com/my-bookings/details/${localizador}/${sobrenome}?market=br&language=pt`;
            dadosForm = { ...dadosForm, localizador, sobrenome };
        }

        const overlay = document.getElementById('reservasLoadingOverlay');
        if (overlay) overlay.style.display = 'flex';

        try {
            const response = await fetch('/api/reservas/capturar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('giramundo_token')
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Erro ao capturar página da companhia');
            }

            const bilhete = this._construirBilhete(
                cia,
                dadosForm,
                data.pageText    || '',
                data.apiData     || [],
                data.pageHtml    || '',
                data.bilheteData || null
            );

            if (overlay) overlay.style.display = 'none';

            const locChave = (dadosForm.localizador || dadosForm.numeroPedido || '').toUpperCase();
            const todas     = Storage.getReservas();
            const jaExiste  = locChave
                ? todas.find(r => r.localizador?.toUpperCase() === locChave && r.companhia === cia)
                : null;
            const jaExisteDb = locChave
                ? this._dbReservas.find(r => r.localizador?.toUpperCase() === locChave && r.companhia === cia)
                : null;

            const dadosReserva = {
                companhia:    dadosForm.companhia,
                localizador:  dadosForm.localizador || dadosForm.numeroPedido || '',
                dataIda:      bilhete.dataIda  || '',
                dataVolta:    bilhete.dataVolta || '',
                origem:       bilhete.origem   || '',
                destino:      bilhete.destino  || '',
                urlReserva:   url,
                _bilhete:     bilhete,
                emitidoPor:   document.getElementById('reservaEmitidoPor')?.value || '',
            };

            let reservaFinal;
            const idDbPuppeteer = jaExisteDb?.id || (jaExiste?._savedInDb ? jaExiste.id : null);
            if (jaExiste || jaExisteDb) {
                if (jaExiste) {
                    Storage.updateReserva(jaExiste.id, dadosReserva);
                    reservaFinal = { ...jaExiste, ...dadosReserva };
                }
                // Atualiza _dbReservas em memória imediatamente
                if (jaExisteDb) {
                    const dbIdx = this._dbReservas.findIndex(r => r.id === jaExisteDb.id);
                    if (dbIdx !== -1) {
                        this._dbReservas[dbIdx] = { ...this._dbReservas[dbIdx], ...dadosReserva, _bilhete: bilhete, _savedInDb: true };
                    }
                }
                if (idDbPuppeteer) {
                    fetch(`/api/reservas/${idDbPuppeteer}`, {
                        method: 'PUT',
                        headers: this._authHeaders(),
                        body: JSON.stringify({
                            dataIda:    bilhete.dataIda   || null,
                            dataVolta:  bilhete.dataVolta || null,
                            origem:     bilhete.origem    || null,
                            destino:    bilhete.destino   || null,
                            urlReserva: url,
                            bilhete:    JSON.stringify(bilhete),
                        })
                    }).catch(e => console.warn('[ReservasModule] Erro ao atualizar no banco:', e.message));
                }
                App.showToast('Reserva atualizada com sucesso!', 'success');
            } else {
                reservaFinal = Storage.addReserva({
                    ...dadosReserva,
                    clienteId:    '',
                    fornecedorId: '',
                    valorVenda:   0,
                    custos:       0,
                    saldo:        0,
                    dataEmissao:  new Date().toISOString(),
                    _savedInDb:   false
                });
                this._registrarAlerta(reservaFinal);
                App.showToast('Reserva adicionada com sucesso!', 'success');
            }

            this.carregarGrid();

        } catch (err) {
            console.error('[ReservasModule] Erro:', err);
            App.showToast('Erro ao consultar companhia: ' + err.message, 'error');
            if (overlay) overlay.style.display = 'none';
        }
    },

    // =====================
    // SALVAR NO BANCO DE DADOS
    // =====================

    // =====================
    // HELPER: headers autenticados
    // =====================

    _authHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('giramundo_token') || '')
        };
    },

    // Verifica se a resposta é 401 e redireciona para login
    _verificarSessao(resp) {
        if (resp.status === 401) {
            App.showToast('Sessão expirada. Faça login novamente.', 'error');
            setTimeout(() => { window.location.href = '/login.html'; }, 1500);
            return false;
        }
        return true;
    },

    // =====================
    // POPUP: pede localizador GOL quando OCR não detectou
    _pedirLocalizadorGol() {
        return new Promise((resolve) => {
            // Remove modal anterior se existir
            const anterior = document.getElementById('modalLocalizadorGol');
            if (anterior) anterior.remove();

            const modal = document.createElement('div');
            modal.id = 'modalLocalizadorGol';
            modal.innerHTML = `
                <div class="modal fade" id="modalLocalizadorGolBs" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title"><i class="bi bi-search me-2"></i>Localizador não detectado</h5>
                            </div>
                            <div class="modal-body">
                                <p class="text-muted mb-3">O localizador não foi encontrado automaticamente no PDF. Digite-o abaixo:</p>
                                <input type="text" id="inputLocalizadorGolPopup" class="form-control text-uppercase text-center fw-bold"
                                       placeholder="Ex: FJGNAF" maxlength="8" autocomplete="off"
                                       oninput="this.value=this.value.toUpperCase()" style="font-size:1.3rem; letter-spacing:0.15em;">
                            </div>
                            <div class="modal-footer justify-content-between">
                                <button type="button" class="btn btn-outline-secondary" id="btnPularLocalizadorGol">Pular</button>
                                <button type="button" class="btn btn-primary" id="btnConfirmarLocalizadorGol">
                                    <i class="bi bi-check-lg"></i> Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const bsModal = new bootstrap.Modal(document.getElementById('modalLocalizadorGolBs'));

            const confirmar = () => {
                const val = (document.getElementById('inputLocalizadorGolPopup')?.value || '').trim().toUpperCase();
                bsModal.hide();
                resolve(val);
            };
            const pular = () => {
                bsModal.hide();
                resolve('');
            };

            document.getElementById('btnConfirmarLocalizadorGol').addEventListener('click', confirmar);
            document.getElementById('btnPularLocalizadorGol').addEventListener('click', pular);

            // Enter confirma
            document.getElementById('inputLocalizadorGolPopup').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirmar();
            });

            // Limpeza após fechar
            document.getElementById('modalLocalizadorGolBs').addEventListener('hidden.bs.modal', () => {
                modal.remove();
            });

            bsModal.show();
            // Foca o input após o modal abrir
            document.getElementById('modalLocalizadorGolBs').addEventListener('shown.bs.modal', () => {
                document.getElementById('inputLocalizadorGolPopup')?.focus();
            }, { once: true });
        });
    },

    // IMPORTAR PDF GOL
    // =====================

    async importarPdfGol() {
        const fileInput = document.getElementById('golPdfInput');
        if (!fileInput || !fileInput.files.length) {
            App.showToast('Selecione um arquivo PDF', 'error');
            return;
        }

        const overlay = document.getElementById('reservasLoadingOverlay');
        if (overlay) overlay.style.display = 'flex';

        try {
            const formData = new FormData();
            formData.append('pdf', fileInput.files[0]);

            const response = await fetch('/api/reservas/capturar-pdf', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('giramundo_token') },
                body: formData
            });

            if (!this._verificarSessao(response)) return;

            const data = await response.json();
            if (!data.success) throw new Error(data.message);

            const b = data.bilhete;

            // Monta objeto bilhete compatível com o resto do sistema
            const trechos = [];
            if (b.ida?.origem) {
                trechos.push({
                    tipo:        'ida',
                    companhia:   'G3',
                    voo:         b.ida.voo,
                    origem:      b.ida.origem,
                    destino:     b.ida.destino,
                    data:        b.ida.data,
                    horaPartida: b.ida.horaPartida,
                    horaChegada: b.ida.horaChegada,
                });
            }
            if (b.volta?.origem) {
                trechos.push({
                    tipo:        'volta',
                    companhia:   'G3',
                    voo:         b.volta.voo,
                    origem:      b.volta.origem,
                    destino:     b.volta.destino,
                    data:        b.volta.data,
                    horaPartida: b.volta.horaPartida,
                    horaChegada: b.volta.horaChegada,
                });
            }

            const bilhete = {
                passageiroNome: b.passageiroNome || '',
                companhia:      'gol',
                trechos,
                dataIda:        b.ida?.data    || '',
                dataVolta:      b.volta?.data  || '',
                origem:         b.ida?.origem  || '',
                destino:        b.ida?.destino || '',
            };

            // Se OCR não detectou o localizador, abre popup para o usuário digitar
            let localizador = (b.localizador || '').trim().toUpperCase();
            if (!localizador) {
                if (overlay) overlay.style.display = 'none';
                localizador = await this._pedirLocalizadorGol();
                if (overlay) overlay.style.display = 'flex';
            }
            const sobrenomeUrl = (b.passageiroNome || '').trim().split(/\s+/).pop() || '';
            const urlReserva   = localizador
                ? `https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem?codigoReserva=${localizador}&origem=${b.ida?.origem || ''}&sobrenome=${encodeURIComponent(sobrenomeUrl.toLowerCase())}`
                : '';

            const dadosReserva = {
                companhia:    'gol',
                localizador,
                dataIda:      bilhete.dataIda,
                dataVolta:    bilhete.dataVolta,
                origem:       bilhete.origem,
                destino:      bilhete.destino,
                urlReserva,
                _bilhete:     bilhete,
                emitidoPor:   document.getElementById('reservaEmitidoPor')?.value || '',
            };

            // Verifica se já existe reserva com mesmo localizador (local ou no banco)
            const todas = Storage.getReservas();
            const jaExiste = localizador
                ? todas.find(r => r.localizador?.toUpperCase() === localizador.toUpperCase())
                : null;
            const jaExisteDb = localizador
                ? this._dbReservas.find(r => r.localizador?.toUpperCase() === localizador.toUpperCase())
                : null;

            let reservaFinal;
            if (jaExiste) {
                // Atualiza localmente preservando cliente, fornecedor e valores
                Storage.updateReserva(jaExiste.id, dadosReserva);
                reservaFinal = { ...jaExiste, ...dadosReserva };
                // Se já estava no banco, atualiza via API também
                if (jaExiste._savedInDb || jaExisteDb) {
                    const idDb = jaExisteDb?.id || jaExiste.id;
                    fetch(`/api/reservas/${idDb}`, {
                        method: 'PUT',
                        headers: this._authHeaders(),
                        body: JSON.stringify({
                            dataIda:    bilhete.dataIda   || null,
                            dataVolta:  bilhete.dataVolta || null,
                            origem:     bilhete.origem    || null,
                            destino:    bilhete.destino   || null,
                            urlReserva,
                            bilhete:    JSON.stringify(bilhete),
                        })
                    }).catch(e => console.warn('[ReservasModule] Erro ao atualizar no banco:', e.message));
                }
                App.showToast('Bilhete GOL atualizado (localizador já existia)!', 'success');
            } else {
                // Nova reserva
                reservaFinal = Storage.addReserva({
                    ...dadosReserva,
                    clienteId:    '',
                    fornecedorId: '',
                    valorVenda:   0,
                    custos:       0,
                    saldo:        0,
                    dataEmissao:  new Date().toLocaleDateString('pt-BR'),
                    _savedInDb:   false
                });
                this._registrarAlerta(reservaFinal);
                App.showToast('Bilhete GOL importado com sucesso!', 'success');
            }

            if (overlay) overlay.style.display = 'none';
            fileInput.value = '';
            this.carregarGrid();

        } catch (err) {
            console.error('[ReservasModule] Erro PDF:', err);
            App.showToast('Erro ao importar PDF: ' + err.message, 'error');
            if (overlay) overlay.style.display = 'none';
        }
    },

    // Serializa uma reserva para envio ao backend
    _serializarReserva(r) {
        return {
            id:           r.id,
            companhia:    r.companhia,
            localizador:  r.localizador,
            dataIda:      r.dataIda      || null,
            dataVolta:    r.dataVolta    || null,
            origem:       r.origem       || null,
            destino:      r.destino      || null,
            clienteId:    r.clienteId    || null,
            fornecedorId: r.fornecedorId || null,
            valorVenda:   r.valorVenda   || 0,
            custos:       r.custos       || 0,
            saldo:        r.saldo        || 0,
            dataEmissao:  r.dataEmissao  || null,
            urlReserva:   r.urlReserva   || null,
            bilhete:      r._bilhete ? JSON.stringify(r._bilhete) : null,
            emitidoPor:   r.emitidoPor   || null
        };
    },

    async salvarNoBanco() {
        const btn = document.getElementById('btnSalvarBanco');
        const localReservas = Storage.getReservas().filter(r => !r._savedInDb);

        if (localReservas.length === 0) {
            App.showToast('Não há reservas pendentes para salvar', 'info');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Salvando...';
        }

        let salvos = 0;
        let erros  = 0;

        for (const r of localReservas) {
            try {
                const resp = await fetch('/api/reservas', {
                    method: 'POST',
                    headers: this._authHeaders(),
                    body: JSON.stringify(this._serializarReserva(r))
                });

                if (!this._verificarSessao(resp)) {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="bi bi-cloud-upload"></i> Salvar no Banco';
                    }
                    return;
                }

                const result = await resp.json();
                if (result.success) {
                    Storage.updateReserva(r.id, { _savedInDb: true });
                    salvos++;
                } else {
                    console.error('[ReservasModule] Erro ao salvar:', result.message);
                    erros++;
                }
            } catch (e) {
                console.error('[ReservasModule] Erro ao salvar reserva:', e.message);
                erros++;
            }
        }

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-cloud-upload"></i> Salvar no Banco';
        }

        if (salvos > 0) {
            App.showToast(`${salvos} reserva(s) salva(s) com sucesso!`, 'success');
            await this._carregarDoDb();
            this.carregarGrid();
        }
        if (erros > 0) {
            App.showToast(`${erros} reserva(s) não puderam ser salvas`, 'error');
        }
    },

    // =====================
    // SALVAR RESERVA INDIVIDUAL NO BANCO
    // =====================

    async salvarReservaIndividual(id) {
        const r = Storage.getReservaById(id);
        if (!r) return;

        try {
            const resp = await fetch('/api/reservas', {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify(this._serializarReserva(r))
            });

            if (!this._verificarSessao(resp)) return;

            const result = await resp.json();
            if (result.success) {
                Storage.updateReserva(id, { _savedInDb: true });
                App.showToast('Reserva salva no banco!', 'success');
                const btn = document.getElementById('btnSalvarIndividual_' + id);
                if (btn) {
                    btn.outerHTML = `<span class="badge bg-success"><i class="bi bi-cloud-check"></i> Salvo</span>`;
                }
            } else {
                App.showToast('Erro ao salvar: ' + result.message, 'error');
            }
        } catch (e) {
            App.showToast('Erro ao salvar reserva', 'error');
        }
    },

    // =====================
    // CARREGAR DO BANCO DE DADOS
    // =====================

    async _carregarDoDb() {
        try {
            const resp = await fetch('/api/reservas', {
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('giramundo_token') || '') }
            });
            if (resp.status === 401) {
                console.warn('[ReservasModule] Sessão expirada ao carregar do banco');
                return;
            }
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.success && Array.isArray(data.reservas)) {
                this._dbReservas = data.reservas.map(r => ({
                    ...r,
                    _bilhete:   r.bilhete ? (typeof r.bilhete === 'string' ? JSON.parse(r.bilhete) : r.bilhete) : null,
                    _savedInDb: true
                }));
                // Sincroniza com localStorage: marca como salvo quem já está no banco
                this._dbReservas.forEach(dbR => {
                    const local = Storage.getReservaById(dbR.id);
                    if (local) {
                        Storage.updateReserva(dbR.id, { _savedInDb: true });
                    }
                });
            }
        } catch (e) {
            console.warn('[ReservasModule] Erro ao carregar do banco:', e.message);
        }
    },

    // =====================
    // GERAR PDF DE UMA RESERVA
    // =====================

    async gerarPDFReserva(id) {
        // Procura no DB primeiro, depois localStorage
        const dbR = this._dbReservas.find(r => r.id === id);
        const reserva = dbR || Storage.getReservaById(id);
        if (!reserva || !reserva._bilhete) {
            App.showToast('Dados do voo não encontrados para esta reserva', 'error');
            return;
        }
        await ReportModule.gerarBilhetePDF(reserva._bilhete);
    },

    // =====================
    // SALVAR CAMPO INLINE
    // =====================

    salvarCampoReserva(id, campo, valor) {
        const update = {};
        update[campo] = valor;

        let saldo = null;

        // Verifica se é do banco ou do localStorage
        const dbR = this._dbReservas.find(r => r.id === id);

        if (dbR) {
            // Atualiza o objeto local imediatamente
            dbR[campo] = valor;
            // Sincroniza o nome exibido na grid ao trocar cliente/fornecedor
            if (campo === 'clienteId') {
                const c = this._clientes.find(c => String(c.id) === String(valor));
                dbR.clienteNome = c ? c.nome : '';
            }
            if (campo === 'fornecedorId') {
                const f = this._fornecedores.find(f => String(f.id) === String(valor));
                dbR.fornecedorNome = f ? f.nome : '';
            }
            if (campo === 'valorVenda' || campo === 'custos') {
                const venda  = parseFloat(campo === 'valorVenda' ? valor : dbR.valorVenda) || 0;
                const custos = parseFloat(campo === 'custos'     ? valor : dbR.custos)     || 0;
                saldo = venda - custos;
                dbR.saldo = saldo;
            }
            // Persiste no banco
            this._atualizarNoBanco(id, campo === 'valorVenda' || campo === 'custos'
                ? { [campo]: valor, saldo }
                : { [campo]: valor });
        } else {
            // localStorage — atualiza e salva no banco automaticamente
            Storage.updateReserva(id, update);
            if (campo === 'valorVenda' || campo === 'custos') {
                const reserva = Storage.getReservaById(id);
                if (reserva) {
                    const venda  = parseFloat(campo === 'valorVenda' ? valor : reserva.valorVenda) || 0;
                    const custos = parseFloat(campo === 'custos'     ? valor : reserva.custos)     || 0;
                    saldo = venda - custos;
                    Storage.updateReserva(id, { saldo });
                }
            }
            // Auto-salva no banco ao editar qualquer campo
            this._salvarLocalNoDb(id);
        }

        if (saldo !== null) {
            const saldoEl = document.getElementById('saldo_' + id);
            if (saldoEl) {
                saldoEl.textContent = this._formatarMoeda(saldo);
                saldoEl.className = (saldo >= 0 ? 'text-success' : 'text-danger') + ' fw-bold';
            }
        }

        // Se o cliente foi alterado, atualiza o alerta (inclui telefone para WhatsApp)
        if (campo === 'clienteId') {
            const reserva = dbR || Storage.getReservaById(id);
            if (reserva) {
                const cliente = valor ? this._clientes.find(c => c.id === valor) : null;
                this._registrarAlerta({
                    ...reserva,
                    clienteNome:     cliente?.nome     || '',
                    clienteTelefone: cliente?.telefone || ''
                });
            }
        }
    },

    _salvarDestinoGrid(id, valor, el) {
        if (!valor) return;
        this.salvarCampoReserva(id, 'destino', valor);
        // Atualiza bilhete em memória para gerar PDF correto
        const dbR = this._dbReservas.find(r => r.id === id);
        if (dbR) { if (dbR._bilhete) dbR._bilhete.destino = valor; }
        else { const r = Storage.getReservaById(id); if (r?._bilhete) { r._bilhete.destino = valor; Storage.updateReserva(id, { _bilhete: r._bilhete, destino: valor }); } }
        this.carregarGrid();
    },

    _salvarDataGrid(id, campo, valor, el) {
        if (!valor) return;
        this.salvarCampoReserva(id, campo, valor);
        // Atualiza bilhete em memória
        const key = campo === 'dataIda' ? 'dataIda' : 'dataVolta';
        const dbR = this._dbReservas.find(r => r.id === id);
        if (dbR) { if (dbR._bilhete) dbR._bilhete[key] = valor; }
        else { const r = Storage.getReservaById(id); if (r?._bilhete) { r._bilhete[key] = valor; Storage.updateReserva(id, { _bilhete: r._bilhete, [campo]: valor }); } }
        this.carregarGrid();
    },

    _salvarReservaAzul(localizador, origem, urlReserva, emitidoPor, bilheteData) {
        const ida   = bilheteData?.ida  || {};
        const volta = bilheteData?.volta || {};
        const bilhete = {
            companhia: 'AD', codigoReserva: localizador,
            passageiroNome: bilheteData?.passageiroNome || '',
            origem:   ida.origem  || origem,
            destino:  ida.destino || '',
            dataIda:  ida.data    || '',
            dataVolta: volta.data || '',
            horaPartida:       ida.horaPartida   || '',
            horaChegada:       ida.horaChegada   || '',
            _horaPartidaVolta: volta.horaPartida || '',
            _horaChegadaVolta: volta.horaChegada || '',
            numeroVoo:       ida.voo   || '',
            _numeroVooVolta: volta.voo || '',
            cabine: '', bagagem: '',
            dataEmissao: new Date().toISOString(),
            trechos: []
        };
        const trechos = [{ tipo: 'ida', data: bilhete.dataIda, origem: bilhete.origem, destino: bilhete.destino, companhia: 'AD', voo: bilhete.numeroVoo, horaPartida: bilhete.horaPartida, horaChegada: bilhete.horaChegada }];
        if (bilhete.dataVolta) trechos.push({ tipo: 'volta', data: bilhete.dataVolta, origem: bilhete.destino, destino: bilhete.origem, companhia: 'AD', voo: bilhete._numeroVooVolta, horaPartida: bilhete._horaPartidaVolta, horaChegada: bilhete._horaChegadaVolta });
        bilhete.trechos = trechos;

        const locChave   = localizador.toUpperCase();
        const todas      = Storage.getReservas();
        const jaExiste   = todas.find(r => r.localizador?.toUpperCase() === locChave && r.companhia === 'azul');
        const jaExisteDb = this._dbReservas.find(r => r.localizador?.toUpperCase() === locChave && r.companhia === 'azul');
        const dadosReserva = {
            companhia: 'azul', localizador,
            dataIda: bilhete.dataIda, dataVolta: bilhete.dataVolta,
            origem: bilhete.origem,   destino: bilhete.destino,
            urlReserva, _bilhete: bilhete, emitidoPor
        };

        let reservaFinal;
        const idDb = jaExisteDb?.id || (jaExiste?._savedInDb ? jaExiste.id : null);
        if (jaExiste || jaExisteDb) {
            if (jaExiste) { Storage.updateReserva(jaExiste.id, dadosReserva); reservaFinal = { ...jaExiste, ...dadosReserva }; }
            if (jaExisteDb) {
                const dbIdx = this._dbReservas.findIndex(r => r.id === jaExisteDb.id);
                if (dbIdx !== -1) this._dbReservas[dbIdx] = { ...this._dbReservas[dbIdx], ...dadosReserva, _bilhete: bilhete, _savedInDb: true };
            }
            if (idDb) {
                fetch(`/api/reservas/${idDb}`, {
                    method: 'PUT', headers: this._authHeaders(),
                    body: JSON.stringify({ dataIda: bilhete.dataIda || null, dataVolta: bilhete.dataVolta || null, origem: bilhete.origem, destino: bilhete.destino, urlReserva, bilhete: JSON.stringify(bilhete) })
                }).catch(e => console.warn('[Azul] Erro ao atualizar:', e.message));
            }
            App.showToast('Reserva Azul atualizada!', 'success');
        } else {
            reservaFinal = Storage.addReserva({ ...dadosReserva, clienteId: '', fornecedorId: '', valorVenda: 0, custos: 0, saldo: 0, dataEmissao: new Date().toISOString(), _savedInDb: false });
            this._registrarAlerta(reservaFinal);
            App.showToast('Reserva Azul adicionada!', 'success');
        }
        this.carregarGrid();
    },

    _salvarReservaGol(localizador, sobrenome, origem, urlReserva, emitidoPor, bilheteData) {
        const ida   = bilheteData?.ida  || {};
        const volta = bilheteData?.volta || {};
        const bilhete = {
            companhia: 'G3', codigoReserva: localizador,
            passageiroNome: bilheteData?.passageiroNome || sobrenome,
            origem:   ida.origem  || origem,
            destino:  ida.destino || '',
            dataIda:  ida.data    || '',
            dataVolta: volta.data || '',
            horaPartida:       ida.horaPartida   || '',
            horaChegada:       ida.horaChegada   || '',
            _horaPartidaVolta: volta.horaPartida || '',
            _horaChegadaVolta: volta.horaChegada || '',
            numeroVoo:       ida.voo   || '',
            _numeroVooVolta: volta.voo || '',
            cabine: '', bagagem: '', dataEmissao: new Date().toISOString(), trechos: []
        };
        const trechos = [{ tipo: 'ida', data: bilhete.dataIda, origem: bilhete.origem, destino: bilhete.destino, companhia: 'G3', voo: bilhete.numeroVoo, horaPartida: bilhete.horaPartida, horaChegada: bilhete.horaChegada }];
        if (bilhete.dataVolta) trechos.push({ tipo: 'volta', data: bilhete.dataVolta, origem: bilhete.destino, destino: bilhete.origem, companhia: 'G3', voo: bilhete._numeroVooVolta, horaPartida: bilhete._horaPartidaVolta, horaChegada: bilhete._horaChegadaVolta });
        bilhete.trechos = trechos;

        const locChave   = localizador.toUpperCase();
        const todas      = Storage.getReservas();
        const jaExiste   = todas.find(r => r.localizador?.toUpperCase() === locChave && r.companhia === 'gol');
        const jaExisteDb = this._dbReservas.find(r => r.localizador?.toUpperCase() === locChave && r.companhia === 'gol');
        const dadosReserva = {
            companhia: 'gol', localizador,
            dataIda: bilhete.dataIda, dataVolta: bilhete.dataVolta,
            origem: bilhete.origem, destino: bilhete.destino,
            urlReserva, _bilhete: bilhete, emitidoPor
        };
        let reservaFinal;
        const idDb = jaExisteDb?.id || (jaExiste?._savedInDb ? jaExiste.id : null);
        if (jaExiste || jaExisteDb) {
            if (jaExiste) { Storage.updateReserva(jaExiste.id, dadosReserva); reservaFinal = { ...jaExiste, ...dadosReserva }; }
            if (jaExisteDb) {
                const dbIdx = this._dbReservas.findIndex(r => r.id === jaExisteDb.id);
                if (dbIdx !== -1) this._dbReservas[dbIdx] = { ...this._dbReservas[dbIdx], ...dadosReserva, _bilhete: bilhete, _savedInDb: true };
            }
            if (idDb) {
                fetch(`/api/reservas/${idDb}`, {
                    method: 'PUT', headers: this._authHeaders(),
                    body: JSON.stringify({ dataIda: bilhete.dataIda || null, dataVolta: bilhete.dataVolta || null, origem: bilhete.origem, destino: bilhete.destino, urlReserva, bilhete: JSON.stringify(bilhete) })
                }).catch(e => console.warn('[GOL] Erro ao atualizar:', e.message));
            }
            App.showToast('Reserva GOL atualizada!', 'success');
        } else {
            reservaFinal = Storage.addReserva({ ...dadosReserva, clienteId: '', fornecedorId: '', valorVenda: 0, custos: 0, saldo: 0, dataEmissao: new Date().toISOString(), _savedInDb: false });
            this._registrarAlerta(reservaFinal);
            App.showToast('Reserva GOL adicionada!', 'success');
        }
        this.carregarGrid();
    },

    _salvarComplementoAzul() {
        const modal       = document.getElementById('modalComplementoAzul');
        const localizador = modal.dataset.localizador;
        const origem      = modal.dataset.origem;
        const urlReserva  = modal.dataset.urlReserva;
        const emitidoPor  = modal.dataset.emitidoPor || '';

        const destino  = document.getElementById('azulModalDestino').value;
        const dataIda  = document.getElementById('azulModalDataIda').value;
        const dataVolta = document.getElementById('azulModalDataVolta').value;

        if (!destino || !dataIda) {
            App.showToast('Preencha Destino e Data de Ida', 'error');
            return;
        }

        bootstrap.Modal.getInstance(modal)?.hide();

        const bilhete = {
            companhia: 'AD', codigoReserva: localizador,
            passageiroNome: '', origem, destino, dataIda, dataVolta: dataVolta || '',
            horaPartida: '', horaChegada: '', _horaPartidaVolta: '', _horaChegadaVolta: '',
            numeroVoo: '', _numeroVooVolta: '', cabine: '', bagagem: '',
            dataEmissao: new Date().toISOString(),
            trechos: [{ tipo: 'ida', data: dataIda, origem, destino, companhia: 'AD', voo: '', horaPartida: '', horaChegada: '' }]
        };
        if (dataVolta) bilhete.trechos.push({ tipo: 'volta', data: dataVolta, origem: destino, destino: origem, companhia: 'AD', voo: '', horaPartida: '', horaChegada: '' });

        const locChave   = localizador.toUpperCase();
        const todas      = Storage.getReservas();
        const jaExiste   = todas.find(r => r.localizador?.toUpperCase() === locChave && r.companhia === 'azul');
        const jaExisteDb = this._dbReservas.find(r => r.localizador?.toUpperCase() === locChave && r.companhia === 'azul');
        const dadosReserva = {
            companhia: 'azul', localizador, dataIda, dataVolta: dataVolta || '',
            origem, destino, urlReserva, _bilhete: bilhete, emitidoPor
        };

        let reservaFinal;
        const idDb = jaExisteDb?.id || (jaExiste?._savedInDb ? jaExiste.id : null);
        if (jaExiste || jaExisteDb) {
            if (jaExiste) { Storage.updateReserva(jaExiste.id, dadosReserva); reservaFinal = { ...jaExiste, ...dadosReserva }; }
            if (jaExisteDb) {
                const dbIdx = this._dbReservas.findIndex(r => r.id === jaExisteDb.id);
                if (dbIdx !== -1) this._dbReservas[dbIdx] = { ...this._dbReservas[dbIdx], ...dadosReserva, _bilhete: bilhete, _savedInDb: true };
            }
            if (idDb) {
                fetch(`/api/reservas/${idDb}`, {
                    method: 'PUT', headers: this._authHeaders(),
                    body: JSON.stringify({ dataIda, dataVolta: dataVolta || null, origem, destino, urlReserva, bilhete: JSON.stringify(bilhete) })
                }).catch(e => console.warn('[Azul] Erro ao atualizar:', e.message));
            }
            App.showToast('Reserva Azul atualizada!', 'success');
        } else {
            reservaFinal = Storage.addReserva({ ...dadosReserva, clienteId: '', fornecedorId: '', valorVenda: 0, custos: 0, saldo: 0, dataEmissao: new Date().toISOString(), _savedInDb: false });
            this._registrarAlerta(reservaFinal);
            App.showToast('Reserva Azul salva!', 'success');
        }
        this.carregarGrid();
    },

    _editarCliente(reservaId) {
        const link = document.querySelector(`a[onclick*="_editarCliente('${reservaId}')"]`);
        if (!link) return;

        const cell = link.closest('td');
        const reserva = this._dbReservas.find(r => r.id === reservaId) || Storage.getReservaById(reservaId);
        const clienteAtualId = reserva?.clienteId || '';

        const optsHtml = this._clientes.map(c =>
            `<option value="${c.id}" ${String(clienteAtualId) === String(c.id) ? 'selected' : ''}>${c.nome}</option>`
        ).join('');

        const select = document.createElement('select');
        select.className = 'form-select form-select-sm';
        select.style.minWidth = '130px';
        select.innerHTML = `<option value="">Selecione...</option>${optsHtml}`;
        select.onchange = () => {
            this.salvarCampoReserva(reservaId, 'clienteId', select.value);
            this.carregarGrid();
        };
        select.onblur = () => this.carregarGrid();

        cell.innerHTML = '';
        cell.appendChild(select);
        select.focus();
    },

    _editarFornecedor(reservaId) {
        const link = document.querySelector(`a[onclick*="_editarFornecedor('${reservaId}')"]`);
        if (!link) return;

        const cell = link.closest('td');
        const reserva = this._dbReservas.find(r => r.id === reservaId) || Storage.getReservaById(reservaId);
        const fornecedorAtualId = reserva?.fornecedorId || '';

        const optsHtml = this._fornecedores.map(f =>
            `<option value="${f.id}" ${String(fornecedorAtualId) === String(f.id) ? 'selected' : ''}>${f.nome}</option>`
        ).join('');

        const select = document.createElement('select');
        select.className = 'form-select form-select-sm';
        select.style.minWidth = '130px';
        select.innerHTML = `<option value="">Selecione...</option>${optsHtml}`;
        select.onchange = () => {
            this.salvarCampoReserva(reservaId, 'fornecedorId', select.value);
            this.carregarGrid();
        };
        select.onblur = () => this.carregarGrid();

        cell.innerHTML = '';
        cell.appendChild(select);
        select.focus();
    },

    async _atualizarNoBanco(id, campos) {
        try {
            const resp = await fetch(`/api/reservas/${id}`, {
                method: 'PUT',
                headers: this._authHeaders(),
                body: JSON.stringify(campos)
            });
            if (resp.status === 401) {
                console.warn('[ReservasModule] Sessão expirada ao atualizar no banco');
            }
        } catch (e) {
            console.warn('[ReservasModule] Erro ao atualizar no banco:', e.message);
        }
    },

    async _salvarLocalNoDb(id) {
        const r = Storage.getReservaById(id);
        if (!r) return;
        try {
            const resp = await fetch('/api/reservas', {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify(this._serializarReserva(r))
            });
            if (!this._verificarSessao(resp)) return;
            const result = await resp.json();
            if (result.success) {
                Storage.updateReserva(id, { _savedInDb: true });
                // Adiciona ao cache local se ainda não estiver
                if (!this._dbReservas.find(d => d.id === id)) {
                    this._dbReservas.push({ ...Storage.getReservaById(id), _savedInDb: true });
                }
                // Atualiza badge e remove botão salvar na linha
                const badge = document.getElementById('badgeSalvo_' + id);
                if (badge) {
                    badge.className = 'badge bg-success mt-1';
                    badge.style.fontSize = '0.65rem';
                    badge.innerHTML = '<i class="bi bi-cloud-check"></i> Salvo';
                }
                const btnInd = document.getElementById('btnSalvarIndividual_' + id);
                if (btnInd) btnInd.remove();
            }
        } catch (e) {
            console.warn('[ReservasModule] Erro ao auto-salvar no banco:', e.message);
        }
    },

    // =====================
    // ALERTAS DE CHECK-IN
    // =====================

    _registrarAlerta(reserva) {
        if (!reserva?.id) return;
        // Busca telefone do cliente no cache local
        const cliente = this._clientes.find(c => c.id === reserva.clienteId);
        const clienteTelefone = reserva.clienteTelefone || cliente?.telefone || '';
        fetch('/api/alertas/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id:              reserva.id,
                companhia:       reserva.companhia,
                localizador:     reserva.localizador,
                dataIda:         reserva.dataIda,
                dataVolta:       reserva.dataVolta,
                origem:          reserva.origem,
                destino:         reserva.destino,
                clienteNome:     reserva.clienteNome     || '',
                clienteTelefone: clienteTelefone,
                emitidoPor:      reserva.emitidoPor      || ''
            })
        }).catch(err => console.warn('[Alertas] Erro ao registrar:', err.message));
    },

    _removerAlerta(reservaId) {
        fetch(`/api/alertas/${reservaId}`, { method: 'DELETE' })
            .catch(err => console.warn('[Alertas] Erro ao remover:', err.message));
    },

    _onFocusMoeda(el) {
        const val = this._parseMoeda(el.value);
        el.value = val > 0 ? val.toFixed(2).replace('.', ',') : '';
        el.select();
    },

    _onBlurMoeda(el, id, campo) {
        const val = this._parseMoeda(el.value);
        el.value = this._formatarMoeda(val);
        this.salvarCampoReserva(id, campo, val);
    },

    // =====================
    // FILTROS
    // =====================

    limparFiltros() {
        const busca     = document.getElementById('reservasBusca');
        const cia       = document.getElementById('reservasFiltroCompanhia');
        const cli       = document.getElementById('reservasFiltroCliente');
        const situacao  = document.getElementById('reservasFiltroSituacao');
        if (busca)    busca.value    = '';
        if (cia)      cia.value      = '';
        if (cli)      cli.value      = '';
        if (situacao) situacao.value = 'pendente';
        this._currentPage = 1;
        this.carregarGrid();
    },

    filtrarGrid() {
        this._currentPage = 1;
        this.carregarGrid();
    },

    toggleSort(col) {
        if (this._sortCol === col) {
            this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this._sortCol = col;
            this._sortDir = 'asc';
        }
        this._currentPage = 1;
        this.carregarGrid();
    },

    mudarPagina(pagina) {
        this._currentPage = pagina;
        this.carregarGrid();
    },

    mudarTamanhoPagina(tamanho) {
        this._pageSize    = tamanho === 'total' ? Infinity : parseInt(tamanho);
        this._currentPage = 1;
        this.carregarGrid();
    },

    // =====================
    // GRID
    // =====================

    async carregarGrid() {
        const container = document.getElementById('reservasGrid');
        if (!container) return;

        // Carrega do banco se ainda não carregou
        if (this._dbReservas.length === 0) {
            await this._carregarDoDb();
        }

        // Carrega clientes e fornecedores da API se ainda não estiverem em cache
        if (this._clientes.length === 0) {
            const resp = await apiCall('/api/clientes');
            if (resp) { const r = await resp.json(); this._clientes = r.data || []; }
        }
        if (this._fornecedores.length === 0) {
            const resp = await apiCall('/api/fornecedores');
            if (resp) { const r = await resp.json(); this._fornecedores = r.data || []; }
        }
        const clientes     = this._clientes;
        const fornecedores = this._fornecedores;

        // Mescla: banco de dados + localStorage (exclui duplicatas por ID e por localizador+cia)
        const dbIds  = new Set(this._dbReservas.map(r => r.id));
        const dbKeys = new Set(this._dbReservas.map(r => `${r.companhia}|${(r.localizador||'').toUpperCase()}`));
        const localReservas = Storage.getReservas().filter(r => {
            if (r._savedInDb) return false;
            if (dbIds.has(r.id)) return false;
            if (r.localizador && dbKeys.has(`${r.companhia}|${r.localizador.toUpperCase()}`)) return false;
            return true;
        });
        let reservas = [...this._dbReservas, ...localReservas];

        if (reservas.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-bookmark-x fs-1"></i>
                    <p class="mt-2">Nenhuma reserva encontrada</p>
                </div>
            `;
            return;
        }

        // --- Filtros ---
        const now        = new Date();
        const todayStr   = now.toISOString().substring(0, 10);
        const filtroTexto    = (document.getElementById('reservasBusca')?.value || '').toLowerCase().trim();
        const filtroCia      = (document.getElementById('reservasFiltroCompanhia')?.value || '').toLowerCase().trim();
        const filtroCliente  = (document.getElementById('reservasFiltroCliente')?.value || '').trim();
        const filtroSituacao = (document.getElementById('reservasFiltroSituacao')?.value || '');

        const clienteMap = {};
        clientes.forEach(c => { clienteMap[c.id] = c.nome.toLowerCase(); });

        if (filtroTexto || filtroCia || filtroCliente || filtroSituacao) {
            reservas = reservas.filter(r => {
                const passTexto = !filtroTexto || (r.localizador || '').toLowerCase().includes(filtroTexto);
                const passCia   = !filtroCia   || (r.companhia   || '').toLowerCase() === filtroCia;
                const passCli   = !filtroCliente || (r.clienteId  || '') === filtroCliente;
                if (!passTexto || !passCia || !passCli) return false;
                if (filtroSituacao) {
                    const dataR = r.dataVolta || r.dataIda || '';
                    let isReal  = false;
                    if (dataR) {
                        const ds = dataR.substring(0, 10);
                        if (ds < todayStr) {
                            isReal = true;
                        } else if (ds === todayStr) {
                            const hora = r.dataVolta
                                ? (r._bilhete?._horaPartidaVolta || '')
                                : (r._bilhete?.horaPartida       || '');
                            if (hora) isReal = new Date(`${ds}T${hora}:00`) < now;
                        }
                    }
                    if (filtroSituacao === 'realizado' && !isReal) return false;
                    if (filtroSituacao === 'pendente'  &&  isReal) return false;
                }
                return true;
            });
        }

        // --- Ordenação ---
        const col = this._sortCol;
        const dir = this._sortDir === 'asc' ? 1 : -1;
        reservas = reservas.slice().sort((a, b) => {
            const va = a[col] || '';
            const vb = b[col] || '';
            if (!va && !vb) return 0;
            if (!va) return 1;
            if (!vb) return -1;
            return va < vb ? -dir : va > vb ? dir : 0;
        });

        // --- Paginação ---
        const totalReservas = reservas.length;
        const pageSize = this._pageSize === Infinity ? totalReservas : this._pageSize;
        const totalPaginas = pageSize > 0 ? Math.ceil(totalReservas / pageSize) : 1;
        if (this._currentPage > totalPaginas) this._currentPage = Math.max(1, totalPaginas);
        const inicio = (this._currentPage - 1) * pageSize;
        const reservasPagina = this._pageSize === Infinity ? reservas : reservas.slice(inicio, inicio + pageSize);
        const fim = Math.min(inicio + pageSize, totalReservas);

        const rows = reservasPagina.map(r => {
            const ciaLabel = r.companhia === 'azul'  ? 'Azul'
                           : r.companhia === 'gol'   ? 'VoeGOL'
                           : r.companhia === 'latam' ? 'LATAM'
                           : r.companhia === 'tap'   ? 'TAP Air Portugal'
                           : (r.companhia || '-');

            const iataCode = r.companhia === 'azul' ? 'AD' : r.companhia === 'gol' ? 'G3' : r.companhia === 'tap' ? 'TP' : 'LA';

            const dataIdaFmt   = this._formatarDataExibicao(r.dataIda);
            const dataVoltaFmt = this._formatarDataExibicao(r.dataVolta);

            // Verifica se a data de ida já passou (data + horário)
            let idaPassou = false;
            if (r.dataIda) {
                const ds = r.dataIda.substring(0, 10);
                if (ds < todayStr) {
                    idaPassou = true;
                } else if (ds === todayStr) {
                    const hora = r._bilhete?.horaPartida || '';
                    if (hora) idaPassou = new Date(`${ds}T${hora}:00`) < now;
                }
            }

            // Verifica se a data de volta já passou
            let voltaPassou = false;
            if (r.dataVolta) {
                const ds = r.dataVolta.substring(0, 10);
                if (ds < todayStr) {
                    voltaPassou = true;
                } else if (ds === todayStr) {
                    const hora = r._bilhete?._horaPartidaVolta || '';
                    if (hora) voltaPassou = new Date(`${ds}T${hora}:00`) < now;
                }
            }

            const origemStr  = r.origem  ? this._descricaoAeroporto(r.origem)  : '-';
            const destinoStr = r.destino ? this._descricaoAeroporto(r.destino) : '-';

            const venda  = parseFloat(r.valorVenda) || 0;
            const custos = parseFloat(r.custos)     || 0;
            const saldo  = parseFloat(r.saldo)      || (venda - custos);
            const saldoClass = (saldo >= 0 ? 'text-success' : 'text-danger') + ' fw-bold';

            const dataRef = r.dataVolta || r.dataIda || '';
            let realizado = false;
            if (dataRef) {
                const ds = dataRef.substring(0, 10);
                if (ds < todayStr) {
                    realizado = true;
                } else if (ds === todayStr) {
                    const hora = r.dataVolta
                        ? (r._bilhete?._horaPartidaVolta || '')
                        : (r._bilhete?.horaPartida       || '');
                    if (hora) realizado = new Date(`${ds}T${hora}:00`) < now;
                }
            }
            const rowStyle = realizado
                ? 'background-color:#e9ecef; color:#6c757d; border-left:3px solid #adb5bd;'
                : '';

            // Para GOL: se a urlReserva salva tem sobrenome vazio, regenera a partir do bilhete
            let urlSite = r.urlReserva || '';
            if (r.companhia === 'gol') {
                const sobMatch = urlSite.match(/[?&]sobrenome=([^&]*)/);
                if (!sobMatch || !sobMatch[1]) urlSite = this._gerarUrlReserva(r) || urlSite;
            }
            if (!urlSite) urlSite = this._gerarUrlReserva(r);
            const linkReserva = urlSite
                ? `<a href="${urlSite}" target="_blank" rel="noopener"
                      title="Abrir no site da companhia"
                      style="text-decoration:none;">
                       <code style="font-size:0.95rem; letter-spacing:0.05em;">${r.localizador || '-'}</code>
                       <i class="bi bi-box-arrow-up-right ms-1" style="font-size:0.75rem;"></i>
                   </a>`
                : `<code style="font-size:0.95rem;">${r.localizador || '-'}</code>`;

            const optsClientes = clientes.map(c =>
                `<option value="${c.id}" ${String(r.clienteId) === String(c.id) ? 'selected' : ''}>${c.nome}</option>`
            ).join('');

            const optsFornecedores = fornecedores.map(f =>
                `<option value="${f.id}" ${String(r.fornecedorId) === String(f.id) ? 'selected' : ''}>${f.nome}</option>`
            ).join('');

            const badgeRealizado = realizado
                ? `<br><span class="badge bg-secondary mt-1" style="font-size:0.65rem;">Realizado</span>`
                : '';

            // Badge de status de salvo
            const badgeSalvo = r._savedInDb
                ? `<br><span id="badgeSalvo_${r.id}" class="badge bg-success mt-1" style="font-size:0.65rem;"><i class="bi bi-cloud-check"></i> Salvo</span>`
                : `<br><span id="badgeSalvo_${r.id}" class="badge bg-warning text-dark mt-1" style="font-size:0.65rem;"><i class="bi bi-cloud"></i> Não salvo</span>`;

            // Botão salvar individual (só para não salvos)
            const btnSalvarIndividual = !r._savedInDb
                ? `<button id="btnSalvarIndividual_${r.id}" class="btn btn-outline-primary btn-sm" title="Salvar no banco"
                           onclick="ReservasModule.salvarReservaIndividual('${r.id}')">
                       <i class="bi bi-cloud-upload"></i>
                   </button>`
                : '';

            const origemTitle  = r.origem  ? origemStr  : '';
            const destinoTitle = r.destino ? destinoStr : '';

            return `
                <tr style="${rowStyle}">
                    <td>
                        ${linkReserva}
                        ${badgeRealizado}
                        ${badgeSalvo}
                    </td>
                    <td style="white-space:normal; word-break:break-word; line-height:1.25;">
                        ${r.clienteNome
                            ? `<span>${r.clienteNome}</span>
                               <br>
                               <a href="#" style="font-size:0.7rem; color:#6c757d;"
                                  onclick="event.preventDefault(); ReservasModule._editarCliente('${r.id}')">
                                  <i class="bi bi-pencil"></i> alterar
                               </a>`
                            : `<select class="form-select form-select-sm"
                                       onchange="ReservasModule.salvarCampoReserva('${r.id}', 'clienteId', this.value)">
                                   <option value="">Selecione...</option>
                                   ${optsClientes}
                               </select>`}
                    </td>
                    <td title="${ciaLabel}" style="white-space:nowrap;">
                        <img src="https://pics.avs.io/200/80/${iataCode}.png" alt="${ciaLabel}"
                             style="height:16px; vertical-align:middle; margin-right:3px;">
                        <span style="font-size:0.75rem;">${ciaLabel}</span>
                    </td>
                    <td title="${origemTitle}" style="font-weight:600; text-align:center;">${r.origem || '-'}</td>
                    <td style="min-width:80px;">
                        ${r.destino
                            ? `<span style="font-weight:600;" title="${destinoTitle}">${r.destino}</span>`
                            : `<select class="form-select form-select-sm p-0" style="font-size:0.78rem;"
                                       onchange="ReservasModule._salvarDestinoGrid('${r.id}', this.value, this)">
                                   <option value="">Destino...</option>
                                   ${this._gerarOpcoesAeroportosBR()}
                               </select>`}
                    </td>
                    <td style="min-width:110px; ${idaPassou ? 'color:#0d6efd; font-weight:500; text-decoration:line-through;' : ''}">
                        ${r.dataIda
                            ? dataIdaFmt
                            : `<input type="date" class="form-control form-control-sm p-0" style="font-size:0.78rem; min-width:110px;"
                                      onchange="ReservasModule._salvarDataGrid('${r.id}', 'dataIda', this.value, this)">`}
                    </td>
                    <td style="min-width:110px; ${voltaPassou ? 'color:#0d6efd; font-weight:500; text-decoration:line-through;' : ''}">
                        ${r.dataVolta
                            ? dataVoltaFmt
                            : `<input type="date" class="form-control form-control-sm p-0" style="font-size:0.78rem; min-width:110px;"
                                      onchange="ReservasModule._salvarDataGrid('${r.id}', 'dataVolta', this.value, this)">`}
                    </td>
                    <td style="white-space:normal; word-break:break-word; line-height:1.25;">
                        ${r.fornecedorNome
                            ? `<span>${r.fornecedorNome}</span>
                               <br>
                               <a href="#" style="font-size:0.7rem; color:#6c757d;"
                                  onclick="event.preventDefault(); ReservasModule._editarFornecedor('${r.id}')">
                                  <i class="bi bi-pencil"></i> alterar
                               </a>`
                            : `<select class="form-select form-select-sm"
                                       onchange="ReservasModule.salvarCampoReserva('${r.id}', 'fornecedorId', this.value)">
                                   <option value="">Selecione...</option>
                                   ${optsFornecedores}
                               </select>`}
                    </td>
                    <td style="white-space:nowrap;">${r.dataEmissao ? new Date(r.dataEmissao).toLocaleDateString('pt-BR') : '-'}</td>
                    <td>
                        <select class="form-select form-select-sm"
                                onchange="ReservasModule.salvarCampoReserva('${r.id}', 'emitidoPor', this.value)">
                            <option value="" ${!r.emitidoPor ? 'selected' : ''}>—</option>
                            <option value="Anderson" ${r.emitidoPor === 'Anderson' ? 'selected' : ''}>Anderson</option>
                            <option value="Gabriela" ${r.emitidoPor === 'Gabriela' ? 'selected' : ''}>Gabriela</option>
                        </select>
                    </td>
                    <td>
                        <div class="d-flex gap-1">
                            <button class="btn btn-outline-danger btn-sm" title="Gerar PDF"
                                    onclick="ReservasModule.gerarPDFReserva('${r.id}')">
                                <i class="bi bi-file-earmark-pdf"></i>
                            </button>
                            ${btnSalvarIndividual}
                            <button class="btn btn-outline-secondary btn-sm" title="Excluir"
                                    onclick="ReservasModule.excluirReserva('${r.id}', ${r._savedInDb ? 'true' : 'false'})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '<i class="bi bi-arrow-down-up text-muted ms-1" style="font-size:0.75rem;"></i>';
            return this._sortDir === 'asc'
                ? '<i class="bi bi-arrow-up ms-1" style="font-size:0.75rem;"></i>'
                : '<i class="bi bi-arrow-down ms-1" style="font-size:0.75rem;"></i>';
        };

        const semResultado = filtroTexto || filtroCia || filtroCliente || filtroSituacao;
        const emptyMsg = totalReservas === 0
            ? `<tr><td colspan="11" class="text-center text-muted py-4">
                   ${semResultado
                       ? 'Nenhuma reserva encontrada para os filtros aplicados'
                       : 'Nenhuma reserva adicionada ainda'}
               </td></tr>`
            : '';

        // --- HTML de paginação ---
        const pagSizeLabel = this._pageSize === Infinity ? 'Total' : this._pageSize;
        let pagBtns = '';
        if (totalPaginas > 1) {
            const maxBtns = 7;
            let pages = [];
            if (totalPaginas <= maxBtns) {
                for (let i = 1; i <= totalPaginas; i++) pages.push(i);
            } else {
                pages = [1];
                if (this._currentPage > 3) pages.push('...');
                for (let i = Math.max(2, this._currentPage - 1); i <= Math.min(totalPaginas - 1, this._currentPage + 1); i++) pages.push(i);
                if (this._currentPage < totalPaginas - 2) pages.push('...');
                pages.push(totalPaginas);
            }
            pagBtns = pages.map(p =>
                p === '...'
                    ? `<li class="page-item disabled"><span class="page-link">…</span></li>`
                    : `<li class="page-item ${p === this._currentPage ? 'active' : ''}">
                           <button class="page-link" onclick="ReservasModule.mudarPagina(${p})">${p}</button>
                       </li>`
            ).join('');
        }

        const paginacaoHTML = totalReservas > 0 ? `
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3 px-1">
                <div class="text-muted" style="font-size:0.82rem;">
                    ${totalReservas === 0 ? 'Nenhuma reserva' : `Exibindo <strong>${inicio + 1}–${fim}</strong> de <strong>${totalReservas}</strong> reserva${totalReservas !== 1 ? 's' : ''}`}
                </div>
                <div class="d-flex align-items-center gap-3">
                    ${pagBtns ? `<nav><ul class="pagination pagination-sm mb-0">
                        <li class="page-item ${this._currentPage === 1 ? 'disabled' : ''}">
                            <button class="page-link" onclick="ReservasModule.mudarPagina(${this._currentPage - 1})"><i class="bi bi-chevron-left"></i></button>
                        </li>
                        ${pagBtns}
                        <li class="page-item ${this._currentPage === totalPaginas ? 'disabled' : ''}">
                            <button class="page-link" onclick="ReservasModule.mudarPagina(${this._currentPage + 1})"><i class="bi bi-chevron-right"></i></button>
                        </li>
                    </ul></nav>` : ''}
                    <div class="d-flex align-items-center gap-1" style="font-size:0.82rem;">
                        <span class="text-muted">Por página:</span>
                        ${[10, 50, 'total'].map(v => {
                            const label = v === 'total' ? 'Total' : v;
                            const active = (v === 'total' && this._pageSize === Infinity) || (v !== 'total' && this._pageSize === v);
                            return `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}"
                                            style="padding:1px 8px; font-size:0.8rem;"
                                            onclick="ReservasModule.mudarTamanhoPagina('${v}')">${label}</button>`;
                        }).join('')}
                    </div>
                </div>
            </div>` : '';

        container.innerHTML = `
            <div id="reservas-scroll-top" class="reservas-scroll-top">
                <div id="reservas-scroll-top-inner" style="height:1px;"></div>
            </div>
            <div id="reservas-table-wrapper" class="table-responsive reservas-table-wrapper">
                <table class="table table-hover table-sm mb-0 align-middle reservas-table">
                    <thead class="table-light">
                        <tr>
                            <th style="min-width:135px;">Reserva</th>
                            <th style="min-width:120px;">Cliente</th>
                            <th style="min-width:70px;">Cia</th>
                            <th style="width:50px;">Orig</th>
                            <th style="width:50px;">Dest</th>
                            <th style="cursor:pointer; user-select:none; width:85px;"
                                onclick="ReservasModule.toggleSort('dataIda')">
                                Ida ${sortIcon('dataIda')}
                            </th>
                            <th style="cursor:pointer; user-select:none; width:85px;"
                                onclick="ReservasModule.toggleSort('dataVolta')">
                                Volta ${sortIcon('dataVolta')}
                            </th>
                            <th style="min-width:120px;">Fornecedor</th>
                            <th style="width:85px;">Emissão</th>
                            <th style="width:100px;">Emitido</th>
                            <th style="width:105px;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || emptyMsg}
                    </tbody>
                </table>
            </div>
            ${paginacaoHTML}
        `;

        // Sincroniza a scrollbar superior com a da tabela
        requestAnimationFrame(() => {
            const scrollTop     = document.getElementById('reservas-scroll-top');
            const tableWrapper  = document.getElementById('reservas-table-wrapper');
            const topInner      = document.getElementById('reservas-scroll-top-inner');
            if (!scrollTop || !tableWrapper || !topInner) return;

            const table = tableWrapper.querySelector('table');
            if (table) topInner.style.width = table.scrollWidth + 'px';

            let syncingTop = false, syncingBot = false;
            scrollTop.addEventListener('scroll', () => {
                if (syncingBot) return;
                syncingTop = true;
                tableWrapper.scrollLeft = scrollTop.scrollLeft;
                syncingTop = false;
            });
            tableWrapper.addEventListener('scroll', () => {
                if (syncingTop) return;
                syncingBot = true;
                scrollTop.scrollLeft = tableWrapper.scrollLeft;
                syncingBot = false;
            });
        });
    },

    excluirReserva(id, savedInDb) {
        App.showConfirm('Excluir Reserva', 'Deseja realmente excluir esta reserva?', async () => {
            // Remove do localStorage
            Storage.deleteReserva(id);
            // Remove do banco se estiver salvo
            if (savedInDb) {
                try {
                    await fetch(`/api/reservas/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('giramundo_token') }
                    });
                } catch (e) {
                    console.warn('[ReservasModule] Erro ao excluir do banco:', e.message);
                }
                // Remove da lista local de DB
                this._dbReservas = this._dbReservas.filter(r => r.id !== id);
            }
            this._removerAlerta(id);
            this.carregarGrid();
            App.showToast('Reserva excluída', 'success');
        });
    },

    // =====================
    // CONSTRUIR BILHETE A PARTIR DOS DADOS CAPTURADOS
    // =====================

    _construirBilhete(cia, dadosForm, pageText, apiData, pageHtml, bilheteData) {
        apiData  = apiData  || [];
        pageHtml = pageHtml || '';

        const iataCode = cia === 'azul' ? 'AD' : cia === 'gol' ? 'G3' : cia === 'tap' ? 'TP' : 'LA';

        const bilhete = {
            companhia:       iataCode,
            codigoReserva:   dadosForm.localizador || dadosForm.numeroPedido || '',
            passageiroNome:  dadosForm.sobrenome   || '',
            origem:          dadosForm.origem      || '',
            destino:         '',
            dataIda:         '',
            dataVolta:       '',
            horaPartida:     '',
            horaChegada:     '',
            _horaPartidaVolta: '',
            _horaChegadaVolta: '',
            _numeroVooVolta:   '',
            numeroVoo:       '',
            cabine:          '',
            bagagem:         '',
            dataEmissao:     new Date().toISOString(),
            trechos:         [],
            tarifa:          0,
            taxaEmbarque:    0,
            valorVenda:      0
        };

        // ============================================================
        // PRIORIDADE: usa bilheteData pré-extraído pelo backend
        // ============================================================
        if (bilheteData) {
            if (bilheteData.passageiroNome) bilhete.passageiroNome = bilheteData.passageiroNome;
            if (bilheteData.ida) {
                const ida = bilheteData.ida;
                if (ida.origem)      bilhete.origem      = ida.origem;
                if (ida.destino)     bilhete.destino     = ida.destino;
                if (ida.data)        bilhete.dataIda      = ida.data;
                if (ida.horaPartida) bilhete.horaPartida = ida.horaPartida;
                if (ida.horaChegada) bilhete.horaChegada = ida.horaChegada;
                if (ida.voo)         bilhete.numeroVoo   = ida.voo;
            }
            if (bilheteData.volta) {
                const volta = bilheteData.volta;
                if (volta.data)        bilhete.dataVolta         = volta.data;
                if (volta.horaPartida) bilhete._horaPartidaVolta = volta.horaPartida;
                if (volta.horaChegada) bilhete._horaChegadaVolta = volta.horaChegada;
                if (volta.voo)         bilhete._numeroVooVolta   = volta.voo;
            }
            console.log('[ReservasModule] bilheteData aplicado:', bilheteData);
        }

        // ============================================================
        // AZUL — Fallback: Extrai dados da API interna interceptada
        // ============================================================
        if (cia === 'azul' && apiData.length > 0) {
            const bookingEntry = apiData.find(e =>
                e.url && e.url.includes('b2c-api.voeazul.com.br') &&
                (e.url.includes('/booking/v5/bookings/') || e.url.includes('/bookings/'))
            );

            if (bookingEntry) {
                console.log('[ReservasModule] Booking API encontrada:', bookingEntry.url);
                const root = bookingEntry.data?.data || bookingEntry.data || {};
                this._extrairPassageiroAzul(root, bilhete);
                this._extrairJourneysAzul(root, bilhete, iataCode);
            } else {
                console.warn('[ReservasModule] Booking API não encontrada. URLs disponíveis:',
                    apiData.map(e => e.url?.substring(0, 80)));
            }
        }

        // ============================================================
        // FALLBACK AZUL: varre HTML buscando datas/rotas
        // ============================================================
        if (cia === 'azul' && (!bilhete.destino || !bilhete.dataIda) && pageHtml) {
            const limite = new Date();
            limite.setDate(limite.getDate() - 90);
            const minData = limite.toISOString().substring(0, 10);
            const isoMatches = [...pageHtml.matchAll(/"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}/g)];
            const datasVoo = isoMatches
                .map(m => ({ data: m[1], hora: m[2] }))
                .filter(d => d.data >= minData)
                .reduce((acc, d) => {
                    if (!acc.find(x => x.data === d.data && x.hora === d.hora)) acc.push(d);
                    return acc;
                }, []);

            if (!bilhete.dataIda && datasVoo.length > 0) {
                bilhete.dataIda     = datasVoo[0].data;
                bilhete.horaPartida = datasVoo[0].hora;
            }
            if (!bilhete.dataVolta && datasVoo.length > 1) {
                bilhete.dataVolta         = datasVoo[1].data;
                bilhete._horaPartidaVolta = datasVoo[1].hora;
            }

            if (!bilhete.destino) {
                const rotaHtml = pageHtml.match(/"origin"\s*:\s*"([A-Z]{3})"[^}]*"destination"\s*:\s*"([A-Z]{3})"/);
                if (rotaHtml) {
                    if (!bilhete.origem || bilhete.origem === rotaHtml[1]) bilhete.origem = rotaHtml[1];
                    bilhete.destino = rotaHtml[2];
                }
            }
            if (!bilhete.destino) {
                const rotaHtml2 = pageHtml.match(/"destination"\s*:\s*"([A-Z]{3})"[^}]*"origin"\s*:\s*"([A-Z]{3})"/);
                if (rotaHtml2) {
                    bilhete.destino = rotaHtml2[1];
                    if (!bilhete.origem) bilhete.origem = rotaHtml2[2];
                }
            }
        }

        // ============================================================
        // FALLBACK: extrai passageiro do HTML da página
        // ============================================================
        if (!bilhete.passageiroNome && pageHtml) {
            const m1 = pageHtml.match(/([A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ]{2,}(?:\s+[A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ]{2,})+)[,.\s]*Passageiro\s+categorizado/i);
            if (m1) bilhete.passageiroNome = m1[1].trim();

            if (!bilhete.passageiroNome) {
                const m2 = pageHtml.match(/Bem[-\s]vindo[,!\s]+([A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇa-záéíóúàãõâêîôûç\s]{3,50})/);
                if (m2) bilhete.passageiroNome = m2[1].trim().split('<')[0].trim();
            }
        }

        // ============================================================
        // FALLBACK: extrai dados do pageText por regex
        // ============================================================
        if (pageText && pageText.trim().length > 50) {
            const txt = pageText;

            if (!bilhete.passageiroNome) {
                const nomePatterns = [
                    /(?:Olá|Ola|Bem[-\s]vindo)[,!\s]+([A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇa-záéíóúàãõâêîôûç\s]{3,50})/,
                    /Passageiro[:\s]+([A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇa-záéíóúàãõâêîôûç\s]{3,50})/i,
                    /(?:Nome|Titular)[:\s]+([A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇa-záéíóúàãõâêîôûç\s]{3,50})/i,
                    /^([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})\s*$/m
                ];
                for (const p of nomePatterns) {
                    const m = txt.match(p);
                    if (m) {
                        const nome = m[1].trim().split('\n')[0].trim();
                        if (nome.length >= 5 && nome.length <= 60) {
                            bilhete.passageiroNome = nome;
                            break;
                        }
                    }
                }
            }

            if (!bilhete.numeroVoo) {
                const vooMatch = txt.match(new RegExp(`${iataCode}[\\s\\-]?(\\d{3,4})`, 'i'));
                if (vooMatch) bilhete.numeroVoo = `${iataCode} ${vooMatch[1]}`;
            }

            if (!bilhete.destino) {
                const rotaMatch = txt.match(/\b([A-Z]{3})\s*(?:→|->|–|para)\s*([A-Z]{3})\b/);
                if (rotaMatch && rotaMatch[1] !== rotaMatch[2]) {
                    if (!bilhete.origem) bilhete.origem = rotaMatch[1];
                    bilhete.destino = rotaMatch[2];
                }
            }

            if (!bilhete.dataIda) {
                const dataPatterns = [
                    /(\d{2}\/\d{2}\/\d{4})/,
                    /(\d{4}-\d{2}-\d{2})/,
                    /(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s+(\d{4})/i
                ];
                for (const p of dataPatterns) {
                    const m = txt.match(p);
                    if (m) { bilhete.dataIda = m[0]; break; }
                }
            }

            if (!bilhete.horaPartida) {
                const horas = [...txt.matchAll(/\b(\d{2}):(\d{2})\b/g)].map(m => m[0]);
                if (horas[0]) bilhete.horaPartida = horas[0];
                if (horas[1]) bilhete.horaChegada = horas[1];
            }

            if (!bilhete.cabine) {
                const cabineM = txt.match(/\b(Econ[oô]mica|Economy|Executiva|Business|Primeira Classe|First Class)\b/i);
                if (cabineM) bilhete.cabine = cabineM[1];
            }

            if (!bilhete.bagagem) {
                const bagagemM = txt.match(/\b(\d+\s*kg|[12]\s*(?:vol|bag|pec|peça|PC)s?|bagagem incluída|sem bagagem|não incluída)\b/i);
                if (bagagemM) bilhete.bagagem = bagagemM[0];
            }
        }

        // ============================================================
        // Monta trechos (ida + volta se houver)
        // ============================================================
        const trechos = [];
        if (bilhete.origem && bilhete.dataIda) {
            trechos.push({
                tipo:        'ida',
                data:        bilhete.dataIda,
                horaPartida: bilhete.horaPartida,
                horaChegada: bilhete.horaChegada,
                origem:      bilhete.origem,
                destino:     bilhete.destino || '',
                voo:         bilhete.numeroVoo
            });
        }
        if (bilhete.dataVolta && bilhete.destino) {
            trechos.push({
                tipo:        'volta',
                data:        bilhete.dataVolta,
                horaPartida: bilhete._horaPartidaVolta || '',
                horaChegada: bilhete._horaChegadaVolta || '',
                origem:      bilhete.destino,
                destino:     bilhete.origem,
                voo:         bilhete._numeroVooVolta || bilhete.numeroVoo
            });
        }
        bilhete.trechos = trechos;

        debugLog('[ReservasModule] Bilhete construído:', bilhete);
        return bilhete;
    },

    // ============================================================
    // Helpers de parsing da API Azul
    // ============================================================

    _extrairPassageiroAzul(root, bilhete) {
        const src = root.passengers || root.booking?.passengers;
        if (!src) return;

        const lista = Array.isArray(src) ? src : Object.values(src);

        for (const p of lista) {
            if (!p) continue;
            if (p.name) {
                const nome = [p.name.first, p.name.last].filter(Boolean).join(' ').trim();
                if (nome.length >= 3) { bilhete.passageiroNome = nome; return; }
            }
            if (p.firstName || p.lastName) {
                const nome = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
                if (nome.length >= 3) { bilhete.passageiroNome = nome; return; }
            }
            if (typeof p === 'string' && p.length >= 3) { bilhete.passageiroNome = p; return; }
        }
    },

    _extrairJourneysAzul(root, bilhete, iataCode) {
        const journeys = root.journeys || root.booking?.journeys || [];
        if (!journeys || journeys.length === 0) {
            console.warn('[ReservasModule] Azul: journeys não encontrado. Chaves do root:', Object.keys(root));
            return;
        }

        const toHora = (val) => {
            if (!val) return '';
            if (/^\d{2}:\d{2}/.test(String(val))) return String(val).substring(0, 5);
            const m = String(val).match(/T(\d{2}:\d{2})/);
            return m ? m[1] : '';
        };

        const toData = (val) => {
            if (!val) return '';
            const m = String(val).match(/(\d{4}-\d{2}-\d{2})/);
            return m ? m[1] : '';
        };

        const parseJourney = (journey, isVolta) => {
            let origin = '', destination = '', departure = '', arrival = '', voo = '';

            const segs = journey.segments || journey.legs || [];
            if (segs.length > 0) {
                const seg = segs[0];
                const des = seg.designator || {};

                origin      = des.origin      || seg.origin      || seg.departureStation || '';
                destination = des.destination || seg.destination || seg.arrivalStation   || '';

                const rawDep = des.departure || seg.departureDateTime || seg.std || '';
                const rawArr = des.arrival   || seg.arrivalDateTime   || seg.sta || '';
                departure = (rawDep && typeof rawDep === 'object')
                    ? (rawDep.local || rawDep.dateTime || rawDep.utc || '')
                    : String(rawDep || '');
                arrival = (rawArr && typeof rawArr === 'object')
                    ? (rawArr.local || rawArr.dateTime || rawArr.utc || '')
                    : String(rawArr || '');

                const ident   = seg.identifier || seg.flightDesignator || seg.flightIdentifier || {};
                const carrier = ident.carrierCode || ident.carrier || iataCode;
                const number  = ident.identifier  || ident.flightNumber || ident.number || '';
                if (number) voo = `${carrier} ${number}`.trim();

                if (!isVolta) {
                    const cabRaw = seg.cabinOfService || seg.cabinClass || seg.cabin || '';
                    const cabStr = typeof cabRaw === 'object' ? (cabRaw.code || cabRaw.description || '') : String(cabRaw);
                    if (cabStr) {
                        const mapa = { Y: 'Econômica', W: 'Econômica Premium', C: 'Executiva', F: 'Primeira Classe',
                                       ECONOMY: 'Econômica', BUSINESS: 'Executiva', FIRST: 'Primeira Classe' };
                        bilhete.cabine = mapa[cabStr.toUpperCase()] || cabStr;
                    }
                }
            }

            if (!origin && journey.designator) {
                const d = journey.designator;
                origin      = d.origin      || '';
                destination = d.destination || '';
                const rawDep = d.departure || '';
                const rawArr = d.arrival   || '';
                departure = (rawDep && typeof rawDep === 'object') ? (rawDep.local || rawDep.dateTime || '') : String(rawDep);
                arrival   = (rawArr && typeof rawArr === 'object') ? (rawArr.local || rawArr.dateTime || '') : String(rawArr);
            }

            if (!origin) {
                const key = journey.journeyKey || journey.key || '';
                if (key) {
                    const parts = key.replace(/^~/, '').split('~');
                    if (parts.length >= 2) {
                        if (/^[A-Z]{3}$/.test(parts[0])) origin      = parts[0];
                        if (/^[A-Z]{3}$/.test(parts[1])) destination = parts[1];
                    }
                    if (parts.length >= 3) {
                        const d = parts[2];
                        if (/^\d{8}$/.test(d)) {
                            departure = `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`;
                        } else if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
                            departure = d;
                        }
                    }
                    if (!toHora(departure) && parts.length >= 4 && /^\d{4}$/.test(parts[3])) {
                        const h = parts[3];
                        departure += `T${h.substring(0,2)}:${h.substring(2,4)}:00`;
                    }
                    if (!voo && parts.length >= 6) {
                        const carrier = parts[4] || iataCode;
                        const num     = parts[5] || '';
                        if (num) voo = `${carrier} ${num}`.trim();
                    }
                }
            }

            if (!isVolta) {
                if (origin)      bilhete.origem      = origin;
                if (destination) bilhete.destino     = destination;
                if (departure) {
                    bilhete.dataIda     = toData(departure);
                    bilhete.horaPartida = toHora(departure);
                }
                if (arrival)     bilhete.horaChegada = toHora(arrival);
                if (voo)         bilhete.numeroVoo   = voo;
            } else {
                if (departure) {
                    bilhete.dataVolta         = toData(departure);
                    bilhete._horaPartidaVolta = toHora(departure);
                }
                if (arrival)  bilhete._horaChegadaVolta = toHora(arrival);
                if (voo)      bilhete._numeroVooVolta    = voo;
            }
        };

        parseJourney(journeys[0], false);
        if (journeys.length > 1) parseJourney(journeys[1], true);
    },

    // =====================
    // HELPERS
    // =====================

    _descricaoAeroporto(codigo) {
        if (!codigo) return '-';
        const airport = typeof getAirportByCode === 'function' ? getAirportByCode(codigo) : null;
        return airport ? `${codigo} — ${airport.city}` : codigo;
    },

    _formatarMoeda(valor) {
        const num = parseFloat(valor) || 0;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    _parseMoeda(str) {
        if (typeof str === 'number') return str;
        const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    },

    _formatarDataExibicao(data) {
        if (!data) return '-';
        const m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data;
        return data;
    },

    _gerarUrlReserva(r) {
        const loc = encodeURIComponent(r.localizador || '');
        if (!loc) return '';
        // Extrai sobrenome do passageiro a partir do bilhete JSON (quando disponível)
        const bilhete = r._bilhete;
        const nomeCompleto = bilhete?.passageiroNome || '';
        const sobrenome = encodeURIComponent(
            (nomeCompleto.trim().split(/\s+/).pop() || '').toLowerCase()
        );
        if (r.companhia === 'azul') {
            const origem = r.origem || '';
            return `https://www.voeazul.com.br/br/pt/home/minhas-viagens/confirmacao?pnr=${loc}&origin=${origem}`;
        }
        if (r.companhia === 'gol') {
            const origem = r.origem || '';
            return `https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem?codigoReserva=${loc}&origem=${origem}&sobrenome=${sobrenome}`;
        }
        if (r.companhia === 'latam') {
            return `https://www.latamairlines.com/br/pt/minhas-viagens/second-detail/?orderId=${loc}`;
        }
        if (r.companhia === 'tap') {
            const sob = encodeURIComponent(
                (r._bilhete?.passageiroNome || '').trim().toUpperCase().replace(/\s+/g, '') ||
                (r.urlReserva?.match(/\/my-bookings\/details\/[^/]+\/([^?]+)/)?.[1] || '')
            );
            return sob
                ? `https://myb.flytap.com/my-bookings/details/${loc}/${sob}?market=br&language=pt`
                : '';
        }
        return '';
    },

    _gerarOpcoesAeroportosBR() {
        const aeroportosBR = AIRPORTS.filter(a => a.countryCode === 'BR')
            .sort((a, b) => a.city.localeCompare(b.city));

        return aeroportosBR.map(a =>
            `<option value="${a.code}">${a.code} — ${a.city}</option>`
        ).join('');
    },

    // =============================================
    // WHATSAPP — PAINEL DE NOTIFICAÇÕES
    // =============================================

    _wppQRInterval: null,

    async _atualizarPainelWpp() {
        try {
            const resp = await fetch('/api/alertas/whatsapp/status');
            if (!resp.ok) return;
            const data = await resp.json();
            this._renderPainelWpp(data);
        } catch (_) {}
    },

    _renderPainelWpp(data) {
        const badge = document.getElementById('wppStatusBadge');
        const body  = document.getElementById('wppCardBody');
        if (!badge || !body) return;

        if (data.status === 'connected') {
            badge.innerHTML = '<span class="badge bg-success"><i class="bi bi-circle-fill me-1" style="font-size:0.5rem;"></i>Conectado</span>';
            body.innerHTML = `
                <div class="d-flex align-items-center gap-3 flex-wrap">
                    <div class="text-success fw-bold small">
                        <i class="bi bi-check-circle-fill me-1"></i>
                        WhatsApp conectado. Notificações serão enviadas automaticamente no dia do check-in.
                    </div>
                    <div class="ms-auto d-flex gap-2">
                        <button class="btn btn-outline-success btn-sm" onclick="ReservasModule._abrirModalTeste()">
                            <i class="bi bi-send me-1"></i>Enviar Teste
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="ReservasModule.desconectarWpp()">
                            <i class="bi bi-x-circle me-1"></i>Desconectar
                        </button>
                    </div>
                </div>`;
        } else if (data.status === 'connecting') {
            badge.innerHTML = '<span class="badge bg-warning text-dark"><i class="bi bi-circle-fill me-1" style="font-size:0.5rem;"></i>Aguardando QR</span>';
            body.innerHTML = `
                <div class="d-flex align-items-center gap-3 flex-wrap">
                    <div class="text-warning fw-bold small">
                        <i class="bi bi-qr-code me-1"></i>
                        Escaneie o QR code para conectar.
                    </div>
                    <button class="btn btn-warning btn-sm ms-auto" onclick="ReservasModule._abrirModalQR()">
                        <i class="bi bi-qr-code me-1"></i>Ver QR Code
                    </button>
                </div>`;
        } else {
            badge.innerHTML = '<span class="badge bg-secondary"><i class="bi bi-circle-fill me-1" style="font-size:0.5rem;"></i>Desconectado</span>';
            body.innerHTML = `
                <div class="d-flex align-items-center gap-3 flex-wrap">
                    <div class="text-muted small">
                        <i class="bi bi-info-circle me-1"></i>
                        Conecte o WhatsApp da agência para enviar notificações de check-in aos clientes.
                    </div>
                    <button class="btn btn-success btn-sm ms-auto" onclick="ReservasModule.conectarWpp()">
                        <i class="bi bi-whatsapp me-1"></i>Conectar WhatsApp
                    </button>
                </div>`;
        }
    },

    async conectarWpp() {
        try {
            // Abre o modal imediatamente (QR chega via polling em até ~15s)
            this._abrirModalQR();
            // Dispara a conexão em background
            fetch('/api/alertas/whatsapp/conectar', { method: 'POST' })
                .catch(err => console.warn('[WhatsApp] Erro ao conectar:', err.message));
        } catch (err) {
            alert('Erro ao iniciar conexão: ' + err.message);
        }
    },

    async desconectarWpp() {
        if (!confirm('Desconectar o WhatsApp? A sessão será apagada e será necessário escanear o QR novamente.')) return;
        try {
            await fetch('/api/alertas/whatsapp/desconectar', { method: 'POST' });
            this._atualizarPainelWpp();
        } catch (err) {
            alert('Erro ao desconectar: ' + err.message);
        }
    },

    _abrirModalQR() {
        const modal = new bootstrap.Modal(document.getElementById('modalWppQR'));
        modal.show();
        this._iniciarPollingQR();
    },

    _iniciarPollingQR() {
        // Limpa polling anterior se existir
        if (this._wppQRInterval) clearInterval(this._wppQRInterval);

        const atualizar = async () => {
            try {
                const resp = await fetch('/api/alertas/whatsapp/status');
                const data = await resp.json();
                const container = document.getElementById('wppQRContainer');
                if (!container) { clearInterval(this._wppQRInterval); return; }

                if (data.status === 'connected') {
                    clearInterval(this._wppQRInterval);
                    container.innerHTML = `
                        <div class="text-success py-3">
                            <i class="bi bi-check-circle-fill" style="font-size:3rem;"></i>
                            <p class="fw-bold mt-2 mb-0">Conectado com sucesso!</p>
                        </div>`;
                    this._renderPainelWpp(data);
                    setTimeout(() => {
                        const m = bootstrap.Modal.getInstance(document.getElementById('modalWppQR'));
                        if (m) m.hide();
                    }, 2000);
                } else if (data.qrBase64) {
                    container.innerHTML = `<img src="${data.qrBase64}" style="width:220px;height:220px;border-radius:8px;" alt="QR Code WhatsApp">`;
                    this._renderPainelWpp(data);
                } else {
                    container.innerHTML = `
                        <div class="spinner-border text-success my-3" role="status"></div>
                        <p class="small text-muted">Aguardando QR code...</p>`;
                }
            } catch (_) {}
        };

        atualizar();
        this._wppQRInterval = setInterval(atualizar, 3000);

        // Para o polling quando o modal fechar
        document.getElementById('modalWppQR').addEventListener('hidden.bs.modal', () => {
            clearInterval(this._wppQRInterval);
            this._atualizarPainelWpp();
        }, { once: true });
    },

    _abrirModalTeste() {
        const modal = new bootstrap.Modal(document.getElementById('modalWppTeste'));
        modal.show();
    },

    async enviarTesteWpp() {
        const telefone = document.getElementById('wppTesteNumero')?.value?.trim();
        const texto    = document.getElementById('wppTesteTexto')?.value?.trim();
        if (!telefone) { alert('Informe o número de celular.'); return; }

        const btn = document.querySelector('#modalWppTeste .btn-success');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Enviando...'; }

        try {
            const resp = await fetch('/api/alertas/whatsapp/testar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telefone, texto })
            });
            const data = await resp.json();
            if (data.success) {
                bootstrap.Modal.getInstance(document.getElementById('modalWppTeste'))?.hide();
                alert('Mensagem enviada com sucesso para ' + telefone + '!');
            } else {
                alert('Erro: ' + data.message);
            }
        } catch (err) {
            alert('Erro ao enviar: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-1"></i> Enviar'; }
        }
    }
};

// Exportar para uso global
window.ReservasModule = ReservasModule;
