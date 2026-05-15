// GiraMundoTour - Monitoramento de Preços de Voos

const MonitoramentoModule = {
    _monitoramentos: [],
    _clientes: [],
    _editandoId: null,

    init() {
        // Nada no init — render() é chamado em App.onPageLoad
    },

    async render() {
        const container = document.getElementById('monitoramentoContent');
        if (!container) return;

        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const [respMon, respCli] = await Promise.all([
                apiCall('/api/monitoramentos'),
                apiCall('/api/clientes?ativo=true')
            ]);
            if (!respMon || !respCli) return;

            const monJson = await respMon.json();
            const cliJson = await respCli.json();

            this._monitoramentos = Array.isArray(monJson) ? monJson : (monJson.data || []);
            this._clientes       = Array.isArray(cliJson) ? cliJson : (cliJson.data || cliJson.clientes || []);
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">Erro ao carregar: ${err.message}</div>`;
            return;
        }

        try {
            this._renderUI();
        } catch (err) {
            console.error('MonitoramentoModule render error:', err);
            document.getElementById('monitoramentoContent').innerHTML =
                `<div class="alert alert-danger">Erro ao renderizar: ${err.message}</div>`;
        }
    },

    _normalizarCia(v) {
        if (!v) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object') return v.nome || v.codigo || '';
        return String(v);
    },

    _renderUI() {
        const container = document.getElementById('monitoramentoContent');
        const ativos = this._monitoramentos.filter(m => m.ativo).length;

        container.innerHTML = `
            <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
                <div class="flex-grow-1">
                    <small class="text-muted">
                        Total: <strong>${this._monitoramentos.length}</strong> •
                        Ativos: <strong class="text-success">${ativos}</strong>
                    </small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="MonitoramentoModule.abrirFormulario()">
                    <i class="bi bi-plus-lg"></i> Novo Monitoramento
                </button>
            </div>

            <div id="monFormWrap"></div>

            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0" style="font-size:0.85rem;">
                            <thead class="table-light">
                                <tr>
                                    <th>Status</th>
                                    <th>Cliente</th>
                                    <th>Telefone</th>
                                    <th>Solicitante</th>
                                    <th>Trecho</th>
                                    <th>Período Ida</th>
                                    <th>Período Volta</th>
                                    <th>Preço Inicial</th>
                                    <th>Preço Atual</th>
                                    <th>Preço Máx</th>
                                    <th>Última Verificação</th>
                                    <th style="width:140px;">Ações</th>
                                </tr>
                            </thead>
                            <tbody>${this._renderRows()}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    _renderRows() {
        if (!this._monitoramentos.length) {
            return `<tr><td colspan="12" class="text-center text-muted py-4">Nenhum monitoramento cadastrado</td></tr>`;
        }

        return this._monitoramentos.map(m => {
            const status = m.ativo
                ? `<span class="badge bg-success">Ativo</span>`
                : `<span class="badge bg-secondary">Pausado</span>`;

            const precoAtual = m.precoAtual != null ? this._fmtMoeda(m.precoAtual) : '<span class="text-muted">-</span>';
            const precoIni = m.precoInicial != null ? this._fmtMoeda(m.precoInicial) : '<span class="text-muted">-</span>';
            const precoAlvo = m.precoAlvo != null ? this._fmtMoeda(m.precoAlvo) : '<span class="text-muted">-</span>';

            const baixou = (m.precoInicial != null && m.precoAtual != null && +m.precoAtual < +m.precoInicial);
            const mv = m.melhorVoo || null;
            const ciaLabel = this._normalizarCia(mv?.companhia || mv?.detalhes?.ida?.companhia);
            const idaDet = mv?.detalhes?.ida || null;
            const horaIda  = (idaDet && typeof idaDet === 'object' && idaDet.partida && typeof idaDet.partida === 'object')
                ? (idaDet.partida.horario || '') : '';
            const detalhesLinha = mv && (ciaLabel || horaIda)
                ? `<div class="small text-muted" style="line-height:1.1;">
                     ${ciaLabel ? `<i class="bi bi-airplane"></i> ${this._escape(ciaLabel)}` : ''}
                     ${horaIda  ? ` • ${horaIda}` : ''}
                   </div>`
                : '';
            const precoAtualHTML = m.precoAtual != null
                ? `${baixou
                    ? `<strong class="text-success">${precoAtual} <i class="bi bi-arrow-down"></i></strong>`
                    : `<strong>${precoAtual}</strong>`}${detalhesLinha}`
                : `<span class="text-muted">-</span>`;

            const periodoIda = `${this._fmtData(m.dataIdaInicio)}${m.dataIdaFim && m.dataIdaFim !== m.dataIdaInicio ? ' → ' + this._fmtData(m.dataIdaFim) : ''}`;
            const periodoVolta = m.tipoViagem === 'idaVolta' && m.dataVoltaInicio
                ? `${this._fmtData(m.dataVoltaInicio)}${m.dataVoltaFim && m.dataVoltaFim !== m.dataVoltaInicio ? ' → ' + this._fmtData(m.dataVoltaFim) : ''}`
                : '<span class="text-muted">—</span>';

            const ultimaVerif = m.ultimaVerificacao
                ? new Date(m.ultimaVerificacao).toLocaleString('pt-BR')
                : '<span class="text-muted">Nunca</span>';

            return `
                <tr>
                    <td>${status}</td>
                    <td>
                        <div style="font-weight:500;">${m.clienteNome || '-'}</div>
                        ${m.clienteEmail ? `<small class="text-muted">${m.clienteEmail}</small>` : ''}
                    </td>
                    <td><small>${m.clienteTelefone || '<span class="text-muted">-</span>'}</small></td>
                    <td><small>${m.solicitante || '<span class="text-muted">-</span>'}</small></td>
                    <td><strong>${m.origem} → ${m.destino}</strong><br>
                        <small class="text-muted">${m.tipoViagem === 'idaVolta' ? 'Ida e Volta' : 'Somente Ida'} • ${m.adultos}adl</small>
                    </td>
                    <td>${periodoIda}</td>
                    <td>${periodoVolta}</td>
                    <td>${precoIni}</td>
                    <td>${precoAtualHTML}</td>
                    <td>${precoAlvo}</td>
                    <td><small>${ultimaVerif}</small></td>
                    <td>
                        <div class="d-flex gap-1 flex-wrap">
                            <button class="btn btn-sm btn-outline-primary" title="Verificar agora"
                                    onclick="MonitoramentoModule.verificarAgora('${m.id}')">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                            ${mv ? `
                            <button class="btn btn-sm btn-outline-info" title="Ver voo encontrado"
                                    onclick="MonitoramentoModule.verMelhorVoo('${m.id}')">
                                <i class="bi bi-eye"></i>
                            </button>` : ''}
                            <button class="btn btn-sm ${m.ativo ? 'btn-outline-warning' : 'btn-outline-success'}"
                                    title="${m.ativo ? 'Pausar' : 'Ativar'}"
                                    onclick="MonitoramentoModule.toggleAtivo('${m.id}', ${!m.ativo})">
                                <i class="bi bi-${m.ativo ? 'pause' : 'play'}-fill"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" title="Editar"
                                    onclick="MonitoramentoModule.abrirFormulario('${m.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" title="Excluir"
                                    onclick="MonitoramentoModule.excluir('${m.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    abrirFormulario(id) {
        this._editandoId = id || null;
        const m = id ? this._monitoramentos.find(x => x.id === id) : {};
        const wrap = document.getElementById('monFormWrap');
        if (!wrap) return;

        const datalistClientes = this._clientes.map(c =>
            `<option value="${(c.nome || '').replace(/"/g, '&quot;')}"></option>`
        ).join('');

        wrap.innerHTML = `
            <div class="card mb-3 border-primary">
                <div class="card-header bg-light d-flex justify-content-between align-items-center">
                    <strong><i class="bi bi-${id ? 'pencil' : 'plus-lg'}"></i> ${id ? 'Editar' : 'Novo'} Monitoramento</strong>
                    <button class="btn btn-sm btn-outline-secondary" onclick="MonitoramentoModule.fecharFormulario()">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="card-body">
                    <form id="monForm" onsubmit="event.preventDefault(); MonitoramentoModule.salvar();">
                        <datalist id="monClientesList">${datalistClientes}</datalist>

                        <div class="row g-3">
                            <div class="col-md-5">
                                <label class="form-label">Cliente</label>
                                <input type="text" class="form-control" id="monClienteNome"
                                       list="monClientesList" autocomplete="off"
                                       value="${(m.clienteNome || '').replace(/"/g, '&quot;')}"
                                       placeholder="Digite o nome ou selecione"
                                       oninput="MonitoramentoModule._onClienteInput()">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Telefone do cliente</label>
                                <input type="text" class="form-control" id="monClienteTelefone"
                                       value="${m.clienteTelefone || ''}" placeholder="(00) 00000-0000">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Solicitante</label>
                                <input type="text" class="form-control" id="monSolicitante"
                                       value="${(m.solicitante || '').replace(/"/g, '&quot;')}"
                                       placeholder="Quem solicitou">
                            </div>

                            <div class="col-md-6">
                                <label class="form-label">Email do cliente <small class="text-muted">(opcional)</small></label>
                                <input type="email" class="form-control" id="monClienteEmail"
                                       value="${m.clienteEmail || ''}" placeholder="cliente@email.com">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Email para notificação</label>
                                <input type="email" class="form-control" id="monEmailDestino"
                                       value="${m.emailDestino || 'giramundotourag@gmail.com'}"
                                       placeholder="giramundotourag@gmail.com">
                            </div>

                            <div class="col-md-3">
                                <label class="form-label">Origem</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bi bi-geo-alt"></i></span>
                                    <input type="text" class="form-control" id="monOrigemInput"
                                           placeholder="Cidade ou IATA" autocomplete="off"
                                           value="${this._fmtAeroportoLabel(m.origem)}">
                                    <input type="hidden" id="monOrigem" value="${m.origem || ''}">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Destino</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bi bi-geo-alt-fill"></i></span>
                                    <input type="text" class="form-control" id="monDestinoInput"
                                           placeholder="Cidade ou IATA" autocomplete="off"
                                           value="${this._fmtAeroportoLabel(m.destino)}">
                                    <input type="hidden" id="monDestino" value="${m.destino || ''}">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Tipo</label>
                                <select class="form-select" id="monTipoViagem" onchange="MonitoramentoModule._toggleVolta()">
                                    <option value="idaVolta" ${m.tipoViagem !== 'ida' ? 'selected' : ''}>Ida e Volta</option>
                                    <option value="ida" ${m.tipoViagem === 'ida' ? 'selected' : ''}>Somente Ida</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Adultos</label>
                                <input type="number" class="form-control" id="monAdultos" min="1" value="${m.adultos || 1}">
                            </div>

                            <div class="col-md-3">
                                <label class="form-label">Ida — De</label>
                                <input type="date" class="form-control" id="monDataIdaInicio"
                                       onchange="MonitoramentoModule._onDateChange('idaInicio')"
                                       value="${m.dataIdaInicio ? String(m.dataIdaInicio).slice(0,10) : ''}" required>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Ida — Até</label>
                                <input type="date" class="form-control" id="monDataIdaFim"
                                       onchange="MonitoramentoModule._onDateChange('idaFim')"
                                       value="${m.dataIdaFim ? String(m.dataIdaFim).slice(0,10) : ''}">
                            </div>
                            <div class="col-md-3" id="monVoltaIniWrap">
                                <label class="form-label">Volta — De</label>
                                <input type="date" class="form-control" id="monDataVoltaInicio"
                                       onchange="MonitoramentoModule._onDateChange('voltaInicio')"
                                       value="${m.dataVoltaInicio ? String(m.dataVoltaInicio).slice(0,10) : ''}">
                            </div>
                            <div class="col-md-3" id="monVoltaFimWrap">
                                <label class="form-label">Volta — Até</label>
                                <input type="date" class="form-control" id="monDataVoltaFim"
                                       value="${m.dataVoltaFim ? String(m.dataVoltaFim).slice(0,10) : ''}">
                            </div>

                            <div class="col-md-3">
                                <label class="form-label">Classe</label>
                                <select class="form-select" id="monClasse">
                                    <option value="economica" ${m.classe !== 'executiva' ? 'selected' : ''}>Econômica</option>
                                    <option value="executiva" ${m.classe === 'executiva' ? 'selected' : ''}>Executiva</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">Preço máximo (R$) <span class="text-danger">*</span></label>
                                <input type="number" step="0.01" class="form-control" id="monPrecoAlvo"
                                       value="${m.precoAlvo || ''}" placeholder="Ex: 1500" required>
                                <small class="text-muted">Notifica ao encontrar valor menor</small>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Observações</label>
                                <input type="text" class="form-control" id="monObservacoes" value="${m.observacoes || ''}">
                            </div>
                        </div>

                        <div class="mt-3 d-flex gap-2 justify-content-end">
                            <button type="button" class="btn btn-outline-secondary" onclick="MonitoramentoModule.fecharFormulario()">Cancelar</button>
                            <button type="submit" class="btn btn-primary"><i class="bi bi-check-lg"></i> Salvar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this._toggleVolta();
        this._setupAeroportos();
        this._onDateChange('idaInicio');
        wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    _onDateChange(campo) {
        const idaIni = document.getElementById('monDataIdaInicio');
        const idaFim = document.getElementById('monDataIdaFim');
        const volIni = document.getElementById('monDataVoltaInicio');
        const volFim = document.getElementById('monDataVoltaFim');
        if (!idaIni) return;

        const vIdaIni = idaIni.value;
        if (vIdaIni) {
            idaFim.min = vIdaIni;
            volIni.min = vIdaIni;
            volFim.min = vIdaIni;
            if (idaFim.value && idaFim.value < vIdaIni) idaFim.value = vIdaIni;
            if (volIni.value && volIni.value < vIdaIni) volIni.value = vIdaIni;
            if (volFim.value && volFim.value < vIdaIni) volFim.value = vIdaIni;
        }

        const vIdaFim = idaFim.value || vIdaIni;
        if (vIdaFim) {
            volIni.min = vIdaFim;
            if (volIni.value && volIni.value < vIdaFim) volIni.value = vIdaFim;
            if (volFim.value && volFim.value < vIdaFim) volFim.value = vIdaFim;
        }

        const vVolIni = volIni.value;
        if (vVolIni) {
            volFim.min = vVolIni;
            if (volFim.value && volFim.value < vVolIni) volFim.value = vVolIni;
        }
    },

    _fmtAeroportoLabel(code) {
        if (!code) return '';
        const a = typeof getAirportByCode === 'function' ? getAirportByCode(code) : null;
        return a ? `${a.city} (${a.code})` : code;
    },

    _setupAeroportos() {
        if (typeof SearchModule === 'undefined' || !SearchModule.setupAutocomplete) return;
        const origemInput  = document.getElementById('monOrigemInput');
        const destinoInput = document.getElementById('monDestinoInput');
        if (origemInput)  SearchModule.setupAutocomplete(origemInput,  'monOrigem');
        if (destinoInput) SearchModule.setupAutocomplete(destinoInput, 'monDestino');
    },

    fecharFormulario() {
        const wrap = document.getElementById('monFormWrap');
        if (wrap) wrap.innerHTML = '';
        this._editandoId = null;
    },

    _toggleVolta() {
        const tipo = document.getElementById('monTipoViagem')?.value;
        const ini = document.getElementById('monVoltaIniWrap');
        const fim = document.getElementById('monVoltaFimWrap');
        const disabled = tipo === 'ida';
        [ini, fim].forEach(el => {
            if (!el) return;
            el.style.opacity = disabled ? '0.5' : '1';
            const input = el.querySelector('input');
            if (input) input.disabled = disabled;
        });
    },

    _onClienteInput() {
        const nomeInput = document.getElementById('monClienteNome');
        if (!nomeInput) return;
        const nome = nomeInput.value.trim().toLowerCase();
        const match = this._clientes.find(c => (c.nome || '').toLowerCase() === nome);
        if (!match) return;
        const telInput   = document.getElementById('monClienteTelefone');
        const emailInput = document.getElementById('monClienteEmail');
        if (telInput   && !telInput.value   && match.telefone) telInput.value   = match.telefone;
        if (emailInput && !emailInput.value && match.email)    emailInput.value = match.email;
    },

    async salvar() {
        const nomeCli = document.getElementById('monClienteNome').value.trim();
        const match = nomeCli ? this._clientes.find(c => (c.nome || '').toLowerCase() === nomeCli.toLowerCase()) : null;

        const payload = {
            clienteId:       match?.id || null,
            clienteNome:     nomeCli || null,
            clienteEmail:    document.getElementById('monClienteEmail').value.trim()    || null,
            clienteTelefone: document.getElementById('monClienteTelefone').value.trim() || null,
            solicitante:     document.getElementById('monSolicitante').value.trim()     || null,
            origem:  document.getElementById('monOrigem').value.trim().toUpperCase(),
            destino: document.getElementById('monDestino').value.trim().toUpperCase(),
            tipoViagem: document.getElementById('monTipoViagem').value,
            dataIdaInicio:   document.getElementById('monDataIdaInicio').value,
            dataIdaFim:      document.getElementById('monDataIdaFim').value || document.getElementById('monDataIdaInicio').value,
            dataVoltaInicio: document.getElementById('monDataVoltaInicio').value || null,
            dataVoltaFim:    document.getElementById('monDataVoltaFim').value || null,
            adultos:   parseInt(document.getElementById('monAdultos').value) || 1,
            classe:    document.getElementById('monClasse').value,
            precoAlvo: document.getElementById('monPrecoAlvo').value || null,
            emailDestino: document.getElementById('monEmailDestino').value.trim() || 'giramundotourag@gmail.com',
            observacoes:  document.getElementById('monObservacoes').value.trim() || null
        };

        if (!payload.origem || !payload.destino || !payload.dataIdaInicio) {
            App.showToast('Preencha origem, destino e data de ida', 'warning');
            return;
        }
        if (!payload.precoAlvo || parseFloat(payload.precoAlvo) <= 0) {
            App.showToast('Informe o preço máximo (valor acima do qual não notifica)', 'warning');
            return;
        }

        try {
            const url    = this._editandoId ? `/api/monitoramentos/${this._editandoId}` : '/api/monitoramentos';
            const method = this._editandoId ? 'PUT' : 'POST';
            const resp   = await apiCall(url, { method, body: JSON.stringify(payload) });
            if (!resp) return;
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                App.showToast('Erro: ' + (err.message || resp.status), 'danger');
                return;
            }
            App.showToast(this._editandoId ? 'Monitoramento atualizado' : 'Monitoramento criado', 'success');
            this.fecharFormulario();
            await this.render();
        } catch (err) {
            App.showToast('Erro: ' + err.message, 'danger');
        }
    },

    async toggleAtivo(id, ativo) {
        const resp = await apiCall(`/api/monitoramentos/${id}/ativo`, {
            method: 'PATCH',
            body: JSON.stringify({ ativo })
        });
        if (!resp || !resp.ok) { App.showToast('Erro ao alterar status', 'danger'); return; }
        await this.render();
    },

    async verificarAgora(id) {
        App.showToast('Verificando preços (pode levar alguns segundos)...', 'info');
        const resp = await apiCall(`/api/monitoramentos/${id}/verificar`, { method: 'POST' });
        if (!resp || !resp.ok) { App.showToast('Erro na verificação', 'danger'); return; }
        const r = await resp.json();
        if (r.resultado?.ok) {
            const msg = r.resultado.notificou
                ? `Preço ${this._fmtMoeda(r.resultado.preco)} — email enviado`
                : `Menor preço encontrado: ${this._fmtMoeda(r.resultado.preco)}`;
            App.showToast(msg, 'success');
        } else {
            App.showToast('Nenhum voo encontrado nesse período', 'warning');
        }
        await this.render();
    },

    excluir(id) {
        App.showConfirm('Excluir Monitoramento', 'Deseja excluir este monitoramento?', async () => {
            const resp = await apiCall(`/api/monitoramentos/${id}`, { method: 'DELETE' });
            if (!resp || !resp.ok) { App.showToast('Erro ao excluir', 'danger'); return; }
            await this.render();
        });
    },

    _fmtMoeda(v) {
        const n = parseFloat(v) || 0;
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    _fmtData(d) {
        if (!d) return '';
        const s = String(d).slice(0, 10);
        const [y, m, dd] = s.split('-');
        return y && m && dd ? `${dd}/${m}` : s;
    },

    _fmtDataCompleta(d) {
        if (!d) return '';
        const s = String(d).slice(0, 10);
        const [y, m, dd] = s.split('-');
        return y && m && dd ? `${dd}/${m}/${y}` : s;
    },

    _escape(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    },

    verMelhorVoo(id) {
        const m = this._monitoramentos.find(x => x.id === id);
        if (!m || !m.melhorVoo) {
            App.showToast('Ainda não há voo encontrado. Clique em Verificar agora.', 'warning');
            return;
        }
        const mv = m.melhorVoo;
        const ida = mv.detalhes?.ida || null;
        const volta = mv.detalhes?.volta || null;

        const renderVoo = (v, titulo) => {
            if (!v || typeof v !== 'object') return '';
            const cia = this._normalizarCia(v.companhia);
            const num = v.numero ? ` <small class="text-muted">#${this._escape(v.numero)}</small>` : '';
            const origemStr = typeof v.origem === 'object' ? (v.origem?.codigo || '') : (v.origem || '');
            const destinoStr = typeof v.destino === 'object' ? (v.destino?.codigo || '') : (v.destino || '');
            const rota = `${origemStr} → ${destinoStr}`;
            const partida = (v.partida && typeof v.partida === 'object') ? v.partida : {};
            const chegada = (v.chegada && typeof v.chegada === 'object') ? v.chegada : {};
            const hora = `${partida.horario || '--:--'} → ${chegada.horario || '--:--'}`;
            const data = this._fmtDataCompleta(partida.data);
            const durStr = (typeof v.duracao === 'object') ? (v.duracao?.texto || '') : (v.duracao || '');
            const dur = durStr ? ` • ${durStr}` : '';
            const escalas = v.escalas === 0 ? 'Direto' : (v.escalas > 0 ? `${v.escalas} escala(s)` : '');
            const precoNum = (typeof v.preco === 'object') ? (v.preco?.valor ?? v.preco?.total ?? null) : v.preco;
            const preco = precoNum != null ? this._fmtMoeda(precoNum) : '';

            return `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <div class="text-uppercase small text-muted">${titulo}</div>
                                <div class="fw-bold"><i class="bi bi-airplane"></i> ${this._escape(cia)}${num}</div>
                                <div class="text-muted small">${rota}</div>
                            </div>
                            <div class="text-end">
                                <div class="fs-5">${hora}</div>
                                <div class="small text-muted">${data}${dur}</div>
                                ${escalas ? `<div class="small"><span class="badge bg-light text-dark">${escalas}</span></div>` : ''}
                            </div>
                        </div>
                        ${preco ? `<div class="mt-2 text-end"><span class="badge bg-success">${preco}</span></div>` : ''}
                    </div>
                </div>
            `;
        };

        const fonteLabel = {
            google_flights: 'Google Flights',
            amadeus: 'Amadeus',
            kiwi: 'Kiwi',
            skyscanner: 'SkyScanner',
            simulado: 'Simulado'
        }[mv.detalhes?.fonte] || (mv.detalhes?.fonte || '');

        const totalHtml = `
            <div class="alert alert-primary d-flex justify-content-between align-items-center mb-3">
                <div>
                    <div class="small">Menor preço encontrado</div>
                    <div class="fs-3 fw-bold">${this._fmtMoeda(mv.preco)}</div>
                </div>
                <div class="text-end">
                    <div class="small text-muted">${m.origem} → ${m.destino}</div>
                    ${fonteLabel ? `<div class="small"><span class="badge bg-secondary">${fonteLabel}</span></div>` : ''}
                </div>
            </div>
        `;

        const modalHtml = `
            <div class="modal fade" id="melhorVooModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-airplane-fill"></i>
                                Voo de menor preço — ${this._escape(m.clienteNome || 'Monitoramento')}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${totalHtml}
                            ${renderVoo(ida,   m.tipoViagem === 'idaVolta' ? 'Ida' : 'Voo')}
                            ${volta ? renderVoo(volta, 'Volta') : ''}
                            ${m.ultimaVerificacao ? `
                                <div class="text-muted small text-end mt-2">
                                    <i class="bi bi-clock"></i>
                                    Consultado em ${new Date(m.ultimaVerificacao).toLocaleString('pt-BR')}
                                </div>` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('melhorVooModal')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('melhorVooModal')).show();
    }
};
