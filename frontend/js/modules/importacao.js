// GiraMundoTour - Módulo de Importação (layout estilo Traveos / Voajet)
//
// Mostra a lista de bilhetes já cadastrados como cards "horizontais" e
// permite importar um novo bilhete por PNR (Azul/GOL/LATAM) — backend
// faz o lookup automático e o usuário confirma o salvamento.

const ImportacaoModule = {

    _bilhetes: [],
    _filtro: { busca: '', dataInicio: '', dataFim: '', ordem: 'recentes' },
    _previewBilhete: null,

    // Mapa companhia → metadata visual
    _ciaMap: {
        'AZUL':  { iata: 'AD', cor: '#1e3a8a', nome: 'AZUL'  },
        'AD':    { iata: 'AD', cor: '#1e3a8a', nome: 'AZUL'  },
        'GOL':   { iata: 'G3', cor: '#f97316', nome: 'GOL'   },
        'G3':    { iata: 'G3', cor: '#f97316', nome: 'GOL'   },
        'LATAM': { iata: 'LA', cor: '#1e3a8a', nome: 'LATAM' },
        'LA':    { iata: 'LA', cor: '#1e3a8a', nome: 'LATAM' },
        'TAP':   { iata: 'TP', cor: '#dc2626', nome: 'TAP'   },
        'TP':    { iata: 'TP', cor: '#dc2626', nome: 'TAP'   },
    },

    init() {
        debugLog('ImportacaoModule: Inicializado');
    },

    async render() {
        const container = document.getElementById('importacaoContent');
        if (!container) return;

        container.innerHTML = `
            <style>
                .imp-header { background:#eef2ff; padding:16px 24px; border-radius:8px; margin-bottom:24px;
                              display:flex; justify-content:space-between; align-items:center; }
                .imp-header h1 { font-size:1.75rem; color:#1e293b; margin:0; }
                .imp-breadcrumb { color:#64748b; font-size:0.9rem; margin-bottom:8px; }
                .imp-breadcrumb a { color:#2563eb; text-decoration:none; }
                .imp-tabs { border-bottom:1px solid #e2e8f0; margin-bottom:24px; display:flex; gap:24px; }
                .imp-tab  { padding:12px 4px; color:#64748b; cursor:pointer; border-bottom:2px solid transparent;
                            font-weight:500; }
                .imp-tab.active { color:#2563eb; border-bottom-color:#2563eb; }
                .imp-filters { display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap; align-items:center; }
                .imp-filters .form-control,
                .imp-filters .form-select { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;
                                            min-width:160px; }
                .imp-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px;
                            margin-bottom:12px; display:flex; align-items:center; gap:16px; transition:box-shadow .15s; }
                .imp-card:hover { box-shadow:0 4px 12px rgba(0,0,0,0.08); }
                .imp-cia-box { width:60px; height:60px; border-radius:10px; display:flex; flex-direction:column;
                               align-items:center; justify-content:center; color:#fff; font-weight:700;
                               font-size:0.85rem; flex-shrink:0; }
                .imp-pnr-block { min-width:140px; }
                .imp-pnr-block .cia { font-size:0.75rem; color:#64748b; text-transform:uppercase; }
                .imp-pnr-block .pnr { font-weight:600; color:#1e293b; letter-spacing:1px; }
                .imp-pax-badge { display:inline-block; background:#f1f5f9; padding:2px 8px; border-radius:6px;
                                 font-size:0.75rem; color:#475569; margin-top:4px; }
                .imp-trecho { flex:1; display:flex; align-items:center; gap:12px; border:1px solid #e2e8f0;
                              border-radius:10px; padding:12px 16px; min-width:0; }
                .imp-time { font-weight:600; color:#1e293b; }
                .imp-airport { font-weight:700; color:#1e293b; }
                .imp-airport-sub { font-size:0.75rem; color:#64748b; }
                .imp-voo-line { flex:1; text-align:center; color:#94a3b8; font-size:0.75rem; }
                .imp-voo-line i { font-size:1rem; color:#475569; }
                .imp-actions { display:flex; flex-direction:column; gap:6px; }
                .imp-actions .btn { min-width:110px; }
                .imp-empty { text-align:center; padding:48px 16px; color:#64748b; }
            </style>

            <div class="imp-breadcrumb">
                <a href="#dashboard"><i class="bi bi-house"></i></a> &rsaquo; Importação
            </div>

            <div class="imp-header">
                <h1><i class="bi bi-ticket-perforated"></i> Bilhetes — Importação</h1>
                <button class="btn btn-primary" id="impNovoBilhete">
                    <i class="bi bi-plus-circle"></i> Novo bilhete
                </button>
            </div>

            <div class="imp-tabs">
                <div class="imp-tab active">Bilhetes</div>
                <div class="imp-tab" title="Em breve">Regras Tarifárias</div>
            </div>

            <div class="imp-filters">
                <div class="position-relative flex-grow-1" style="max-width:380px;">
                    <input id="impBusca" type="text" class="form-control"
                           placeholder="Pesquise por localizador, nome, ID e etc">
                </div>
                <input id="impDataInicio" type="date" class="form-control" style="max-width:170px;">
                <input id="impDataFim"    type="date" class="form-control" style="max-width:170px;">
                <select id="impOrdem" class="form-select" style="max-width:180px;">
                    <option value="recentes">Mais Recentes</option>
                    <option value="antigos">Mais Antigos</option>
                </select>
                <button class="btn btn-link text-decoration-none" id="impLimpar">Limpar Filtro</button>
            </div>

            <div id="impLista">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                </div>
            </div>
        `;

        this._bindEvents();
        await this._carregarBilhetes();
    },

    _bindEvents() {
        document.getElementById('impNovoBilhete').onclick = () => this._mostrarModalImportar();
        document.getElementById('impLimpar').onclick = () => {
            this._filtro = { busca: '', dataInicio: '', dataFim: '', ordem: 'recentes' };
            document.getElementById('impBusca').value = '';
            document.getElementById('impDataInicio').value = '';
            document.getElementById('impDataFim').value = '';
            document.getElementById('impOrdem').value = 'recentes';
            this._carregarBilhetes();
        };
        let buscaTimer;
        document.getElementById('impBusca').oninput = (e) => {
            clearTimeout(buscaTimer);
            buscaTimer = setTimeout(() => {
                this._filtro.busca = e.target.value;
                this._carregarBilhetes();
            }, 350);
        };
        document.getElementById('impDataInicio').onchange = (e) => {
            this._filtro.dataInicio = e.target.value;
            this._carregarBilhetes();
        };
        document.getElementById('impDataFim').onchange = (e) => {
            this._filtro.dataFim = e.target.value;
            this._carregarBilhetes();
        };
        document.getElementById('impOrdem').onchange = (e) => {
            this._filtro.ordem = e.target.value;
            this._renderLista();
        };
    },

    async _carregarBilhetes() {
        const lista = document.getElementById('impLista');
        lista.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;
        try {
            const params = new URLSearchParams();
            if (this._filtro.busca)      params.append('busca', this._filtro.busca);
            if (this._filtro.dataInicio) params.append('dataInicio', this._filtro.dataInicio);
            if (this._filtro.dataFim)    params.append('dataFim', this._filtro.dataFim);
            params.append('limit', '200');

            const resp = await apiCall(`/api/bilhetes?${params.toString()}`);
            this._bilhetes = resp.data || [];
            this._renderLista();
        } catch (err) {
            console.error('Erro ao carregar bilhetes:', err);
            lista.innerHTML = `<div class="alert alert-danger">Erro ao carregar bilhetes: ${err.message}</div>`;
        }
    },

    _renderLista() {
        const lista = document.getElementById('impLista');
        let arr = [...this._bilhetes];
        arr.sort((a, b) => {
            const da = new Date(a.dataEmissao || a.createdAt || 0).getTime();
            const db = new Date(b.dataEmissao || b.createdAt || 0).getTime();
            return this._filtro.ordem === 'antigos' ? da - db : db - da;
        });

        if (!arr.length) {
            lista.innerHTML = `<div class="imp-empty">
                <i class="bi bi-inbox" style="font-size:3rem; opacity:0.4;"></i>
                <p class="mt-3">Nenhum bilhete encontrado. Clique em <strong>Novo bilhete</strong> para importar pelo PNR.</p>
            </div>`;
            return;
        }

        lista.innerHTML = arr.map(b => this._renderCard(b)).join('');

        lista.querySelectorAll('[data-acao="ver"]').forEach(el => {
            el.onclick = () => App.navigate('bilhetes');
        });
        lista.querySelectorAll('[data-acao="reserva"]').forEach(el => {
            const id = el.dataset.id;
            el.onclick = () => {
                const b = this._bilhetes.find(x => x.id === id);
                if (b?.codigoReserva && b?.companhia) {
                    const url = this._reservaUrl(b.companhia, b.codigoReserva);
                    if (url) window.open(url, '_blank');
                }
            };
        });
    },

    _reservaUrl(companhia, pnr) {
        const c = (companhia || '').toUpperCase();
        if (c.includes('AZUL') || c === 'AD')   return `https://www.voeazul.com.br/br/pt/home/minhas-viagens/confirmacao?pnr=${pnr}`;
        if (c.includes('GOL')  || c === 'G3')   return `https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem?codigoReserva=${pnr}`;
        if (c.includes('LATAM')|| c === 'LA')   return `https://www.latamairlines.com/br/pt/mytrips?recordLocator=${pnr}`;
        return null;
    },

    _renderCard(b) {
        const ciaKey = (b.companhia || '').toUpperCase();
        const cia = this._ciaMap[ciaKey] || { iata: ciaKey.slice(0,2), cor: '#475569', nome: ciaKey };
        const trechos = Array.isArray(b.trechos) ? b.trechos : (typeof b.trechos === 'string' ? this._safeJson(b.trechos) : []);
        const t0 = trechos[0] || {};
        const origem  = b.origem  || t0.origem  || '';
        const destino = b.destino || t0.destino || '';
        const dataIda = this._fmtData(b.dataIda || t0.partida);
        const horaP   = b.horaPartida || (t0.partida || '').split('T')[1]?.slice(0,5) || '--:--';
        const horaC   = b.horaChegada || (t0.chegada  || '').split('T')[1]?.slice(0,5) || '--:--';
        const numVoo  = b.numeroVoo || t0.numero || '';
        const pax     = Array.isArray(b.passageiros) ? b.passageiros.length : (typeof b.passageiros === 'string' ? (this._safeJson(b.passageiros)?.length || 1) : 1);
        const paxTxt  = pax === 1 ? '1 Passageiro' : `${pax} Passageiros`;

        return `
            <div class="imp-card">
                <div class="imp-cia-box" style="background:${cia.cor}">
                    <span style="font-size:1.1rem;">${cia.iata}</span>
                </div>
                <div class="imp-pnr-block">
                    <div class="cia">${cia.nome}</div>
                    <div class="pnr">${b.codigoReserva || '-'}</div>
                    <div class="imp-pax-badge">${paxTxt}</div>
                </div>
                <div class="imp-trecho">
                    <div class="text-center">
                        <div class="imp-time">${horaP}</div>
                        <div class="imp-airport-sub">${dataIda}</div>
                    </div>
                    <div class="text-center" style="min-width:80px;">
                        <div class="imp-airport">${origem}</div>
                        <div class="imp-airport-sub">${this._airportName(origem)}</div>
                    </div>
                    <div class="imp-voo-line">
                        <i class="bi bi-airplane"></i><br>
                        ${numVoo ? `Voo ${numVoo}` : ''}
                    </div>
                    <div class="text-center" style="min-width:80px;">
                        <div class="imp-airport">${destino}</div>
                        <div class="imp-airport-sub">${this._airportName(destino)}</div>
                    </div>
                    <div class="text-center">
                        <div class="imp-time">${horaC}</div>
                        <div class="imp-airport-sub">${dataIda}</div>
                    </div>
                </div>
                <div class="imp-actions">
                    <button class="btn btn-primary btn-sm" data-acao="ver" data-id="${b.id}">
                        <i class="bi bi-ticket-perforated"></i> Bilhete
                    </button>
                    <button class="btn btn-outline-primary btn-sm" data-acao="reserva" data-id="${b.id}">
                        <i class="bi bi-box-arrow-up-right"></i> Reserva
                    </button>
                </div>
            </div>
        `;
    },

    _safeJson(s) { try { return JSON.parse(s); } catch (_) { return null; } },

    _fmtData(d) {
        if (!d) return '';
        const s = String(d).split('T')[0];
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
    },

    _airportName(iata) {
        if (!iata || typeof getAirportByCode !== 'function') return '';
        const a = getAirportByCode(iata);
        return a ? a.cidade : '';
    },

    // ─────────────────────────────────────────────────────────────
    // Modal de importação por PNR
    // ─────────────────────────────────────────────────────────────
    _mostrarModalImportar() {
        const html = `
            <div class="modal fade" id="impModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-cloud-download"></i> Importar Bilhete por PNR</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="impForm">
                                <div class="mb-3">
                                    <label class="form-label">Companhia *</label>
                                    <div class="d-flex gap-3 flex-wrap">
                                        <div class="form-check">
                                            <input class="form-check-input" type="radio" name="impCia" id="impCiaAzul" value="AZUL" checked>
                                            <label class="form-check-label" for="impCiaAzul">
                                                <img src="https://pics.avs.io/200/80/AD.png" style="height:18px;"> Azul
                                            </label>
                                        </div>
                                        <div class="form-check">
                                            <input class="form-check-input" type="radio" name="impCia" id="impCiaGol" value="GOL">
                                            <label class="form-check-label" for="impCiaGol">
                                                <img src="https://pics.avs.io/200/80/G3.png" style="height:18px;"> GOL
                                            </label>
                                        </div>
                                        <div class="form-check">
                                            <input class="form-check-input" type="radio" name="impCia" id="impCiaLatam" value="LATAM">
                                            <label class="form-check-label" for="impCiaLatam">
                                                <img src="https://pics.avs.io/200/80/LA.png" style="height:18px;"> LATAM
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div class="row g-3">
                                    <div class="col-md-4">
                                        <label class="form-label">Localizador (PNR) *</label>
                                        <input id="impPnr" type="text" class="form-control text-uppercase"
                                               placeholder="Ex: UZWHWG" maxlength="6" required>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Origem (IATA)</label>
                                        <input id="impOrigem" type="text" class="form-control text-uppercase"
                                               placeholder="Ex: GRU" maxlength="3">
                                        <small class="text-muted">Necessário para Azul/GOL</small>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">Sobrenome</label>
                                        <input id="impLastName" type="text" class="form-control"
                                               placeholder="Sobrenome do titular">
                                        <small class="text-muted">Necessário para GOL/LATAM</small>
                                    </div>
                                </div>
                            </form>

                            <div id="impPreview" class="mt-3"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="impBtnBuscar">
                                <i class="bi bi-search"></i> Buscar dados do voo
                            </button>
                            <button type="button" class="btn btn-success d-none" id="impBtnSalvar">
                                <i class="bi bi-check-circle"></i> Salvar bilhete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('impModal')?.remove();
        document.body.insertAdjacentHTML('beforeend', html);
        const modal = new bootstrap.Modal(document.getElementById('impModal'));
        modal.show();

        document.getElementById('impBtnBuscar').onclick = () => this._buscarPNR();
        document.getElementById('impBtnSalvar').onclick = () => this._salvarBilhete(modal);
    },

    async _buscarPNR() {
        const pnr      = document.getElementById('impPnr').value.toUpperCase().trim();
        const companhia= document.querySelector('input[name="impCia"]:checked').value;
        const origem   = document.getElementById('impOrigem').value.toUpperCase().trim();
        const lastName = document.getElementById('impLastName').value.trim();
        const preview  = document.getElementById('impPreview');
        const btnB     = document.getElementById('impBtnBuscar');

        if (!pnr) { preview.innerHTML = `<div class="alert alert-warning">Informe o PNR.</div>`; return; }
        if ((companhia === 'AZUL' || companhia === 'GOL') && !origem) {
            preview.innerHTML = `<div class="alert alert-warning">Origem (IATA) é obrigatória para ${companhia}.</div>`;
            return;
        }
        if ((companhia === 'GOL' || companhia === 'LATAM') && !lastName) {
            preview.innerHTML = `<div class="alert alert-warning">Sobrenome é obrigatório para ${companhia}.</div>`;
            return;
        }

        btnB.disabled = true;
        btnB.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Buscando...`;
        preview.innerHTML = `<div class="alert alert-info"><i class="bi bi-hourglass-split"></i> Consultando ${companhia}... pode levar até 1 minuto.</div>`;

        try {
            const resp = await apiCall('/api/importacao/pnr', {
                method: 'POST',
                body: JSON.stringify({ pnr, companhia, origem, lastName }),
            });
            if (!resp.success) throw new Error(resp.message || 'Falha ao buscar PNR');

            this._previewBilhete = resp.bilhete;
            preview.innerHTML = `
                <div class="alert alert-success"><i class="bi bi-check-circle"></i> Bilhete encontrado!</div>
                <div class="card"><div class="card-body">
                    <div class="row">
                        <div class="col-md-6"><strong>Companhia:</strong> ${resp.bilhete.companhia}</div>
                        <div class="col-md-6"><strong>PNR:</strong> ${resp.bilhete.codigoReserva}</div>
                        <div class="col-md-6 mt-2"><strong>Origem → Destino:</strong> ${resp.bilhete.origem} → ${resp.bilhete.destino}</div>
                        <div class="col-md-6 mt-2"><strong>Data:</strong> ${this._fmtData(resp.bilhete.dataIda)}</div>
                        <div class="col-md-6 mt-2"><strong>Partida:</strong> ${resp.bilhete.horaPartida || '-'}</div>
                        <div class="col-md-6 mt-2"><strong>Chegada:</strong> ${resp.bilhete.horaChegada || '-'}</div>
                        <div class="col-md-6 mt-2"><strong>Voo:</strong> ${resp.bilhete.numeroVoo || '-'}</div>
                        <div class="col-md-6 mt-2"><strong>Passageiros:</strong> ${(resp.bilhete.passageiros || []).length}</div>
                    </div>
                    ${(resp.bilhete.passageiros || []).length ? `
                        <hr><strong>Passageiros:</strong>
                        <ul class="mb-0">${resp.bilhete.passageiros.map(p => `<li>${p.nome || '(sem nome)'}</li>`).join('')}</ul>
                    ` : ''}
                </div></div>
            `;
            document.getElementById('impBtnSalvar').classList.remove('d-none');
        } catch (err) {
            preview.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${err.message}</div>`;
        } finally {
            btnB.disabled = false;
            btnB.innerHTML = `<i class="bi bi-search"></i> Buscar dados do voo`;
        }
    },

    async _salvarBilhete(modal) {
        if (!this._previewBilhete) return;
        const b = this._previewBilhete;
        const btn = document.getElementById('impBtnSalvar');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;

        try {
            await apiCall('/api/bilhetes', {
                method: 'POST',
                body: JSON.stringify({
                    codigoReserva: b.codigoReserva,
                    companhia:     b.companhia,
                    origem:        b.origem,
                    destino:       b.destino,
                    dataIda:       b.dataIda,
                    horaPartida:   b.horaPartida,
                    horaChegada:   b.horaChegada,
                    numeroVoo:     b.numeroVoo,
                    passageiroNome:(b.passageiros && b.passageiros[0]?.nome) || null,
                    passageiros:   b.passageiros || [],
                    trechos:       b.trechos || [],
                    status:        'emitido',
                    dataEmissao:   new Date().toISOString().split('T')[0],
                }),
            });
            modal.hide();
            App.showToast?.('Bilhete importado com sucesso!', 'success');
            this._previewBilhete = null;
            await this._carregarBilhetes();
        } catch (err) {
            document.getElementById('impPreview').insertAdjacentHTML('beforeend',
                `<div class="alert alert-danger mt-2">Erro ao salvar: ${err.message}</div>`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="bi bi-check-circle"></i> Salvar bilhete`;
        }
    },
};
