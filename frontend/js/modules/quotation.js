// GiraMundoTour - Módulo de Cotações

// Taxas de parcelamento cartão presencial (1x a 10x) — conforme "taxa cartão de crédito.txt"
const TAXAS_CARTAO = [4, 5.00, 6, 6.67, 7.4, 8.5, 9, 10, 11, 11.16];

// Taxas de parcelamento Mercado Pago link (1x a 10x) — conforme "taxasMP.txt"
const TAXAS_MP = [5.24, 10.58, 12.29, 14.03, 15.79, 17.56, 19.36, 21.18, 23.01, 24.86];

const QuotationModule = {
    cotacaoAtual: null,

    /**
     * Inicializa o módulo de cotações
     */
    init() {
        this.bindEvents();
        debugLog('QuotationModule: Inicializado');
    },

    /**
     * Vincula eventos
     */
    bindEvents() {
        // Sem eventos de seleção de cliente
    },

    /**
     * Inicia nova cotação
     * @param {object} dados - Dados da cotação (voos, passageiros)
     */
    novaCotacao(dados) {
        // Normaliza voos para formato português (campos usados internamente)
        const voosNormalizados = (dados.voos || []).map(v => this._normalizarVoo(v));

        this.cotacaoAtual = {
            voos: voosNormalizados,
            passageiros: dados.passageiros || { adultos: 1, criancas: 0, bebes: 0 },
            clienteId: null,
            cliente: null
        };

        this.calcularPrecos();
        debugLog('QuotationModule: Nova cotação criada', this.cotacaoAtual);
    },

    /**
     * Normaliza voo de formato API (inglês) para formato interno (português)
     */
    _normalizarVoo(voo) {
        // Já no formato plano correto
        if (typeof voo.companhia === 'string' && typeof voo.preco === 'number') return voo;

        // Extrai de formato aninhado (SerpAPI/Skyscanner)
        const cia   = typeof voo.companhia === 'object' && voo.companhia ? voo.companhia : {};
        const ori   = typeof voo.origem    === 'object' && voo.origem    ? voo.origem    : {};
        const dest  = typeof voo.destino   === 'object' && voo.destino   ? voo.destino   : {};
        const preco = typeof voo.preco     === 'object' && voo.preco     ? voo.preco     : {};
        const part  = typeof voo.partida   === 'object' && voo.partida   ? voo.partida   : {};
        const cheg  = typeof voo.chegada   === 'object' && voo.chegada   ? voo.chegada   : {};
        const dur   = typeof voo.duracao   === 'object' && voo.duracao   ? voo.duracao   : {};

        return {
            ...voo,
            companhia:           cia.codigo      || voo.companhia      || voo.airline       || '',
            companhiaNome:       cia.nome         || voo.companhiaNome  || voo.airlineName   || '',
            companhiaCor:        cia.cor          || voo.companhiaCor   || voo.airlineColor  || '',
            numeroVoo:           voo.numero       || voo.numeroVoo      || voo.flightNumber  || '',
            origem:              ori.codigo       || voo.origin         || '',
            destino:             dest.codigo      || voo.destination    || '',
            dataPartida:         voo.dataPartida  || part.timestamp     || (part.data && part.horario ? `${part.data}T${part.horario}` : '') || (voo.departureDate ? `${voo.departureDate}T${voo.departureTime || '00:00'}:00` : '') || '',
            dataChegada:         voo.dataChegada  || cheg.timestamp     || (cheg.data && cheg.horario ? `${cheg.data}T${cheg.horario}` : '') || (voo.arrivalDate   ? `${voo.arrivalDate}T${voo.arrivalTime   || '00:00'}:00` : '') || '',
            duracao:             typeof voo.duracao === 'number' ? voo.duracao : (dur.total || voo.duration || 0),
            escalas:             voo.escalas      ?? voo.stops          ?? 0,
            classe:              voo.classe       || voo.class          || 'economica',
            preco:               typeof voo.preco === 'number' ? voo.preco : (preco.porPessoa || preco.valor || voo.price || 0),
            assentosDisponiveis: voo.assentos     || voo.assentosDisponiveis || voo.seats    || 9,
            segmentos:           voo.segmentos    || undefined
        };
    },

    /**
     * Calcula preços da cotação
     */
    calcularPrecos() {
        if (!this.cotacaoAtual) return;

        const { voos, passageiros } = this.cotacaoAtual;
        const { adultos, criancas, bebes } = passageiros;

        // Preço base dos voos
        let subtotalBase = 0;
        voos.forEach(voo => {
            const precoAdultos = voo.preco * adultos;
            const precoCriancas = voo.preco * 0.75 * criancas;
            const precoBebes = voo.preco * 0.10 * bebes;
            subtotalBase += precoAdultos + precoCriancas + precoBebes;
        });

        // Markup embutido no subtotal
        const markup = subtotalBase * CONFIG.cotacao.markup;
        const subtotalVoos = subtotalBase + markup;

        // Taxas
        const totalPassageiros = adultos + criancas;
        const taxaEmbarque = CONFIG.cotacao.taxaEmbarque * totalPassageiros * voos.length;

        // Valor por pessoa e taxa por pessoa
        const totalPax = Math.max(adultos + criancas + bebes, 1);
        const valorPorPessoa = subtotalVoos / totalPax;
        const taxaPorPessoa = taxaEmbarque / totalPax;

        // Total = (valorPorPessoa + taxaPorPessoa) × totalPax
        const total = Math.round((valorPorPessoa + taxaPorPessoa) * totalPax * 100) / 100;

        this.cotacaoAtual.precos = {
            subtotalVoos: Math.round(subtotalVoos * 100) / 100,
            taxaEmbarque: Math.round(taxaEmbarque * 100) / 100,
            valorPorPessoa: Math.round(valorPorPessoa * 100) / 100,
            taxaPorPessoa: Math.round(taxaPorPessoa * 100) / 100,
            totalPax,
            subtotal: Math.round(subtotalVoos * 100) / 100,
            taxas: Math.round(taxaEmbarque * 100) / 100,
            total
        };
    },

    /**
     * Renderiza a página de cotação
     */
    render() {
        const container = document.getElementById('cotacaoContent');
        if (!container) return;

        if (!this.cotacaoAtual || this.cotacaoAtual.voos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-file-earmark-x"></i>
                    <h4>Nenhum voo selecionado</h4>
                    <p>Faça uma busca e selecione os voos para criar uma cotação</p>
                    <button class="btn btn-primary" onclick="App.navigate('busca')">
                        <i class="bi bi-search"></i> Buscar Voos
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="row">
                <!-- Detalhes dos Voos -->
                <div class="col-lg-8">
                    <div class="card mb-4">
                        <div class="card-header">
                            <i class="bi bi-airplane"></i> Voos Selecionados
                        </div>
                        <div class="card-body">
                            ${this.renderVoosSelecionados()}
                        </div>
                    </div>

                    <!-- Seleção de Cliente -->
                    <div class="card mb-4">
                        <div class="card-header">
                            <i class="bi bi-person"></i> Cliente
                        </div>
                        <div class="card-body">
                            ${this.renderSelecaoCliente()}
                        </div>
                    </div>
                </div>

                <!-- Resumo da Cotação -->
                <div class="col-lg-4">
                    <div class="card sticky-top" style="top: 100px;">
                        <div class="card-header bg-primary text-white">
                            <i class="bi bi-receipt"></i> Resumo da Cotação
                        </div>
                        <div class="card-body">
                            ${this.renderResumo()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    /**
     * Renderiza voos selecionados
     */
    renderVoosSelecionados() {
        const { voos, passageiros } = this.cotacaoAtual;

        return voos.map((voo, index) => {
            const origemAirport = getAirportByCode(voo.origem);
            const destinoAirport = getAirportByCode(voo.destino);

            return `
                <div class="flight-card mb-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="badge bg-primary">${voo.tipo === 'ida' ? 'Ida' : 'Volta'}</span>
                            <span class="badge bg-secondary">${Formatter.flightClass(voo.classe)}</span>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="QuotationModule.removerVoo(${index})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>

                    <div class="row align-items-center">
                        <div class="col-md-2 text-center">
                            <div class="airline-logo-placeholder" style="background-color: ${voo.companhiaCor}; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; margin: 0 auto;">
                                ${getAirlineInitials(voo.companhia)}
                            </div>
                            <small class="d-block mt-1">${voo.companhiaNome}</small>
                            <small class="text-muted">${voo.numeroVoo}</small>
                        </div>

                        <div class="col-md-7">
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="text-center">
                                    <div class="fw-bold">${Formatter.time(voo.dataPartida)}</div>
                                    <div class="text-muted small">${voo.origem}</div>
                                    <div class="text-muted small">${Formatter.date(voo.dataPartida)}</div>
                                </div>

                                <div class="flex-grow-1 text-center px-3">
                                    <div class="border-bottom border-2" style="position: relative;">
                                        <i class="bi bi-airplane position-absolute" style="top: -8px; left: 50%; transform: translateX(-50%); background: white; padding: 0 5px;"></i>
                                    </div>
                                    <small class="text-muted">${Formatter.duration(voo.duracao)} • ${Formatter.stops(voo.escalas)}</small>
                                </div>

                                <div class="text-center">
                                    <div class="fw-bold">${Formatter.time(voo.dataChegada)}</div>
                                    <div class="text-muted small">${voo.destino}</div>
                                    <div class="text-muted small">${Formatter.date(voo.dataChegada)}</div>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-3 text-end">
                            <div class="fs-5 fw-bold text-primary">${Formatter.currency(voo.preco)}</div>
                            <small class="text-muted">por pessoa</small>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Renderiza campos de identificação do cliente para o relatório
     */
    renderSelecaoCliente() {
        const nome     = this.cotacaoAtual.clienteNome     || '';
        const telefone = this.cotacaoAtual.clienteTelefone || '';
        return `
            <div class="row g-3">
                <div class="col-md-7">
                    <label class="form-label">Nome do Cliente *</label>
                    <input type="text" class="form-control" id="cotacaoClienteNome"
                           placeholder="Nome completo" value="${nome.replace(/"/g, '&quot;')}">
                </div>
                <div class="col-md-5">
                    <label class="form-label">Telefone</label>
                    <input type="tel" class="form-control" id="cotacaoClienteTelefone"
                           placeholder="(00) 00000-0000" value="${telefone.replace(/"/g, '&quot;')}">
                </div>
            </div>
        `;
    },

    /**
     * Renderiza resumo da cotação
     */
    renderResumo() {
        const { precos, passageiros } = this.cotacaoAtual;
        const validade = new Date();
        validade.setDate(validade.getDate() + CONFIG.cotacao.validadeDias);

        // Usa valores personalizados se existirem, senao usa os calculados
        const valores = this.cotacaoAtual.valoresPersonalizados || {};
        const valorPorPessoaExibido = valores.valorPorPessoa != null ? valores.valorPorPessoa : precos.valorPorPessoa;
        const taxaPorPessoaExibida = valores.taxaPorPessoa != null ? valores.taxaPorPessoa : precos.taxaPorPessoa;
        const totalPax = precos.totalPax || 1;
        const totalExibido = valores.total != null ? valores.total : precos.total;

        const qtdBagagensExibida  = valores.qtdBagagens  != null ? valores.qtdBagagens  : 0;
        const valorBagagemExibido = valores.valorBagagem != null ? valores.valorBagagem : 0;

        const temAlteracao = valores.valorPorPessoa != null || valores.taxaPorPessoa != null
            || valores.total != null || qtdBagagensExibida > 0;

        const fp = this.cotacaoAtual.formaPagamento || '';
        const st = this.cotacaoAtual.subtipoCartao  || '';

        return `
            <div class="quotation-summary">
                <div class="quotation-item">
                    <span>Passageiros</span>
                    <span>${Formatter.passengers(passageiros)}</span>
                </div>

                <div class="quotation-item">
                    <span>Valor por Pessoa</span>
                    <input type="text" class="form-control form-control-sm text-end quotation-edit-input"
                           value="${Formatter.currency(valorPorPessoaExibido)}"
                           data-campo="valorPorPessoa" data-raw="${valorPorPessoaExibido.toFixed(2)}"
                           onfocus="QuotationModule.focusCampoMoeda(this)"
                           onblur="QuotationModule.blurCampoMoeda(this)">
                </div>

                <div class="quotation-item">
                    <span>Taxa de Embarque por Pessoa</span>
                    <input type="text" class="form-control form-control-sm text-end quotation-edit-input"
                           value="${Formatter.currency(taxaPorPessoaExibida)}"
                           data-campo="taxaPorPessoa" data-raw="${taxaPorPessoaExibida.toFixed(2)}"
                           onfocus="QuotationModule.focusCampoMoeda(this)"
                           onblur="QuotationModule.blurCampoMoeda(this)">
                </div>

                <div class="quotation-item fw-bold" style="color:#1a365d;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:2px;">
                    <span>Total por Pessoa</span>
                    <span>${Formatter.currency(valorPorPessoaExibido + taxaPorPessoaExibida)}</span>
                </div>

                <div class="quotation-item align-items-center" style="border-top:1px solid #e2e8f0;padding-top:6px;margin-top:2px;">
                    <span>Bagagem 23kg</span>
                    <div class="d-flex align-items-center gap-1">
                        <input type="number" min="0" step="1"
                               class="form-control form-control-sm text-center"
                               style="width:60px"
                               value="${qtdBagagensExibida}"
                               title="Quantidade de bagagens"
                               onchange="QuotationModule.atualizarCampo('qtdBagagens', this.value)">
                        <span class="text-muted small">×</span>
                        <input type="text" class="form-control form-control-sm text-end quotation-edit-input"
                               style="width:110px"
                               value="${Formatter.currency(valorBagagemExibido)}"
                               data-campo="valorBagagem" data-raw="${valorBagagemExibido.toFixed(2)}"
                               title="Valor por bagagem"
                               onfocus="QuotationModule.focusCampoMoeda(this)"
                               onblur="QuotationModule.blurCampoMoeda(this)">
                    </div>
                </div>

                <div class="quotation-item quotation-total">
                    <span>Total (${totalPax} pax)</span>
                    <input type="text" class="form-control form-control-sm fw-bold text-end quotation-edit-input quotation-edit-total"
                           value="${Formatter.currency(totalExibido)}"
                           data-campo="total" data-raw="${totalExibido.toFixed(2)}"
                           onfocus="QuotationModule.focusCampoMoeda(this)"
                           onblur="QuotationModule.blurCampoMoeda(this)">
                </div>
                ${temAlteracao ? `
                    <div class="text-end mt-2">
                        <small class="text-muted">Valor original: ${Formatter.currency(precos.total)}</small>
                        <button class="btn btn-link btn-sm p-0 ms-2" onclick="QuotationModule.restaurarValorOriginal()">
                            <i class="bi bi-arrow-counterclockwise"></i> Restaurar
                        </button>
                    </div>
                ` : ''}
            </div>

            <div class="mt-3 border-top pt-3">
                <div class="fw-bold small mb-2"><i class="bi bi-credit-card-2-front me-1"></i>Forma de Pagamento</div>
                <div class="d-flex gap-2 mb-2">
                    <button class="btn btn-sm ${fp === 'pix' ? 'btn-success' : 'btn-outline-secondary'}"
                            onclick="QuotationModule.selecionarFormaPagamento('pix')">
                        <i class="bi bi-qr-code"></i> PIX
                    </button>
                    <button class="btn btn-sm ${fp === 'cartao' ? 'btn-primary' : 'btn-outline-secondary'}"
                            onclick="QuotationModule.selecionarFormaPagamento('cartao')">
                        <i class="bi bi-credit-card"></i> Cartão de Crédito
                    </button>
                </div>
                ${fp === 'pix' ? `
                    <div class="alert alert-success py-2 px-3 mb-0 small">
                        <i class="bi bi-check-circle-fill me-1"></i>
                        PIX: <strong>${Formatter.currency(totalExibido)}</strong> (sem acréscimo)
                    </div>` : ''}
                ${fp === 'cartao' ? `
                    <div class="mb-2">
                        <div class="small text-muted mb-1">Modalidade do cartão:</div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm ${st === 'mercadopago' ? 'btn-warning text-dark' : 'btn-outline-secondary'}"
                                    onclick="QuotationModule.selecionarSubtipoCartao('mercadopago')">
                                <i class="bi bi-link-45deg"></i> Mercado Pago
                            </button>
                            <button class="btn btn-sm ${st === 'presencial' ? 'btn-primary' : 'btn-outline-secondary'}"
                                    onclick="QuotationModule.selecionarSubtipoCartao('presencial')">
                                <i class="bi bi-shop"></i> Presencial
                            </button>
                        </div>
                    </div>
                    ${st ? this._renderTabelaParcelamento(totalExibido) : '<div class="text-muted small">Selecione a modalidade acima para ver o parcelamento.</div>'}
                ` : ''}
            </div>

            <div class="mt-3">
                <small class="text-muted">
                    <i class="bi bi-clock"></i> Válido até ${Formatter.date(validade)}
                </small>
            </div>

            <div class="d-grid gap-2 mt-4">
                <button class="btn btn-success btn-lg" onclick="QuotationModule.salvarCotacao()">
                    <i class="bi bi-check-circle"></i> Salvar Cotação
                </button>
                <button class="btn btn-outline-primary" onclick="QuotationModule.gerarPDF()">
                    <i class="bi bi-file-pdf"></i> Gerar PDF
                </button>
            </div>
        `;
    },

    /**
     * Seleciona forma de pagamento (pix | cartao)
     */
    selecionarFormaPagamento(tipo) {
        this._salvarCamposCliente();
        if (!this.cotacaoAtual) return;
        this.cotacaoAtual.formaPagamento = tipo;
        if (tipo !== 'cartao') {
            this.cotacaoAtual.parcelasSelecionadas = null;
            this.cotacaoAtual.subtipoCartao = null;
        }
        this.render();
    },

    /**
     * Seleciona modalidade do cartão (mercadopago | presencial)
     */
    selecionarSubtipoCartao(subtipo) {
        this._salvarCamposCliente();
        if (!this.cotacaoAtual) return;
        this.cotacaoAtual.subtipoCartao = subtipo;
        this.cotacaoAtual.parcelasSelecionadas = null; // reset parcela ao trocar modalidade
        this.render();
    },

    /**
     * Seleciona número de parcelas no cartão
     */
    selecionarParcela(parcelas) {
        this._salvarCamposCliente();
        if (!this.cotacaoAtual) return;
        this.cotacaoAtual.parcelasSelecionadas = parcelas;
        this.render();
    },

    /**
     * Renderiza tabela de parcelamento no cartão.
     * Usa TAXAS_MP para Mercado Pago e TAXAS_CARTAO para presencial.
     */
    _renderTabelaParcelamento(total) {
        const parcSel  = this.cotacaoAtual.parcelasSelecionadas || null;
        const subtipo  = this.cotacaoAtual.subtipoCartao || 'presencial';
        const taxas    = subtipo === 'mercadopago' ? TAXAS_MP : TAXAS_CARTAO;
        const labelMP  = subtipo === 'mercadopago'
            ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem">Mercado Pago</span>'
            : '<span class="badge bg-primary ms-1" style="font-size:0.65rem">Presencial</span>';

        let rows = '';
        taxas.forEach((taxa, idx) => {
            const n = idx + 1;
            const totalComTaxa = Math.round(total * (1 + taxa / 100) * 100) / 100;
            const valorParcela = Math.round(totalComTaxa / n * 100) / 100;
            const sel = parcSel === n;
            rows += `<tr style="cursor:pointer;${sel ? 'background:#fff3cd;font-weight:600' : ''}"
                         onclick="QuotationModule.selecionarParcela(${n})">
                <td class="text-center">${n}x</td>
                <td class="text-end">${Formatter.currency(valorParcela)}</td>
                <td class="text-end">${Formatter.currency(totalComTaxa)}</td>
                <td class="text-end text-muted" style="font-size:0.7rem">${taxa.toFixed(2)}%</td>
            </tr>`;
        });

        const destaque = parcSel ? (() => {
            const taxa = taxas[parcSel - 1];
            const totalComTaxa = Math.round(total * (1 + taxa / 100) * 100) / 100;
            const valorParcela = Math.round(totalComTaxa / parcSel * 100) / 100;
            return `<div class="alert alert-primary py-2 px-3 mb-0 small mt-1">
                <i class="bi bi-credit-card-fill me-1"></i>
                <strong>${parcSel}x de ${Formatter.currency(valorParcela)}</strong> = ${Formatter.currency(totalComTaxa)}
                &nbsp;|&nbsp; <i class="bi bi-qr-code me-1"></i>PIX: ${Formatter.currency(total)}
            </div>`;
        })() : '';

        return `
            <div class="table-responsive" style="max-height:220px;overflow-y:auto">
                <table class="table table-sm table-bordered mb-0" style="font-size:0.75rem">
                    <thead class="table-primary sticky-top">
                        <tr>
                            <th class="text-center">Parcelas ${labelMP}</th>
                            <th class="text-center">Valor/Parcela</th>
                            <th class="text-center">Total</th>
                            <th class="text-center">Taxa</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${destaque}`;
    },

    /**
     * Ao focar no campo, mostra o valor numérico puro para edição
     */
    focusCampoMoeda(input) {
        input.value = input.dataset.raw;
        input.select();
    },

    /**
     * Ao sair do campo, formata como moeda e aplica a alteração
     */
    blurCampoMoeda(input) {
        const campo = input.dataset.campo;
        let valorStr = input.value.replace(/[^\d.,]/g, '');

        // Detecta formato BR (ex: 2.500,75) vs EN (ex: 2500.75)
        if (valorStr.includes(',')) {
            // Remove pontos de milhar e converte vírgula decimal para ponto
            valorStr = valorStr.replace(/\./g, '').replace(',', '.');
        }

        const num = parseFloat(valorStr);

        if (isNaN(num) || num < 0) {
            // Restaura valor anterior
            input.value = Formatter.currency(parseFloat(input.dataset.raw));
            return;
        }

        const valorLimpo = Math.round(num * 100) / 100;
        input.dataset.raw = valorLimpo.toFixed(2);
        input.value = Formatter.currency(valorLimpo);
        this.atualizarCampo(campo, valorLimpo.toString());
    },

    /**
     * Atualiza um campo personalizado da cotacao
     * @param {string} campo - Nome do campo (subtotalVoos, taxaEmbarque, total)
     * @param {string} valor - Novo valor
     */
    atualizarCampo(campo, valor) {
        const num = campo === 'qtdBagagens' ? parseInt(valor) : parseFloat(valor);
        if (isNaN(num) || num < 0) return;

        if (!this.cotacaoAtual.valoresPersonalizados) {
            this.cotacaoAtual.valoresPersonalizados = {};
        }

        this.cotacaoAtual.valoresPersonalizados[campo] = campo === 'qtdBagagens'
            ? Math.max(0, num)
            : Math.round(num * 100) / 100;

        // Recalcula o total automaticamente (exceto quando o campo é o próprio total)
        if (campo !== 'total') {
            const valores = this.cotacaoAtual.valoresPersonalizados;
            const precos  = this.cotacaoAtual.precos;
            const totalPax  = precos.totalPax || 1;
            const vpp       = valores.valorPorPessoa != null ? valores.valorPorPessoa : precos.valorPorPessoa;
            const tpp       = valores.taxaPorPessoa  != null ? valores.taxaPorPessoa  : precos.taxaPorPessoa;
            const qtdBag    = valores.qtdBagagens    != null ? valores.qtdBagagens    : 0;
            const valBag    = valores.valorBagagem   != null ? valores.valorBagagem   : 0;
            const bagTotal  = qtdBag * valBag;
            this.cotacaoAtual.valoresPersonalizados.total =
                Math.round(((vpp + tpp) * totalPax + bagTotal) * 100) / 100;
        }

        this._salvarCamposCliente();
        this.render();
    },

    /**
     * Restaura todos os valores originais calculados
     */
    restaurarValorOriginal() {
        this.cotacaoAtual.valoresPersonalizados = null;
        this._salvarCamposCliente();
        this.render();
    },

    /**
     * Remove voo da cotação
     */
    removerVoo(index) {
        this.cotacaoAtual.voos.splice(index, 1);

        if (this.cotacaoAtual.voos.length === 0) {
            this.cotacaoAtual = null;
        } else {
            this.calcularPrecos();
        }

        this.render();
    },

    /**
     * Persiste nome e telefone digitados em cotacaoAtual para sobreviver ao render()
     */
    _salvarCamposCliente() {
        if (!this.cotacaoAtual) return;
        const nome     = document.getElementById('cotacaoClienteNome')?.value;
        const telefone = document.getElementById('cotacaoClienteTelefone')?.value;
        if (nome     != null) this.cotacaoAtual.clienteNome     = nome;
        if (telefone != null) this.cotacaoAtual.clienteTelefone = telefone;
    },

    /**
     * Lê nome e telefone dos campos do formulário
     */
    _lerDadosCliente() {
        const nome     = (document.getElementById('cotacaoClienteNome')?.value || '').trim();
        const telefone = (document.getElementById('cotacaoClienteTelefone')?.value || '').trim();
        return { nome, telefone };
    },

    /**
     * Salva cotação
     */
    async salvarCotacao() {
        if (!this.cotacaoAtual) return;

        const { nome, telefone } = this._lerDadosCliente();
        if (!nome) {
            alert('Informe o nome do cliente para salvar a cotação.');
            document.getElementById('cotacaoClienteNome')?.focus();
            return;
        }

        const valores = this.cotacaoAtual.valoresPersonalizados || {};
        const precos  = this.cotacaoAtual.precos;

        const subtotalFinal     = valores.subtotalVoos  != null ? valores.subtotalVoos  : precos.subtotalVoos;
        const taxaEmbarqueFinal = valores.taxaEmbarque  != null ? valores.taxaEmbarque  : precos.taxaEmbarque;
        const totalFinal        = valores.total         != null ? valores.total         : precos.total;

        const validade = new Date();
        validade.setDate(validade.getDate() + CONFIG.cotacao.validadeDias);

        // Tenta encontrar o clienteId pelo nome na lista de clientes carregada
        let clienteId = null;
        if (window.ClientsModule && ClientsModule._clientes && ClientsModule._clientes.length > 0) {
            const nomeNorm = nome.trim().toLowerCase();
            const match = ClientsModule._clientes.find(c =>
                (c.nome || '').trim().toLowerCase() === nomeNorm
            );
            if (match) clienteId = match.id;
        }

        // Se não achou pelo nome exato, tenta busca parcial
        if (!clienteId) {
            try {
                const res = await apiCall('/clientes?limit=1000');
                const lista = res.data || res.clientes || [];
                const nomeNorm = nome.trim().toLowerCase();
                const match = lista.find(c => (c.nome || '').trim().toLowerCase() === nomeNorm);
                if (match) clienteId = match.id;
            } catch (_) {}
        }

        // Monta observacoes com nome+telefone quando não há clienteId
        const obsCliente = !clienteId ? `Cliente: ${nome}${telefone ? ' | Tel: ' + telefone : ''}` : null;

        const payload = {
            clienteId,
            voos:        this.cotacaoAtual.voos,
            passageiros: this.cotacaoAtual.passageiros,
            subtotal:    subtotalFinal,
            taxas:       taxaEmbarqueFinal,
            total:       totalFinal,
            validade:    validade.toISOString(),
            observacoes: obsCliente
        };

        try {
            const resp = await apiCall('/api/cotacoes', { method: 'POST', body: JSON.stringify(payload) });
            if (!resp) return;
            const result = await resp.json();
            if (result.success) {
                this.cotacaoAtual.id   = result.data.id;
                this.cotacaoAtual.salva = true;
                alert('Cotação salva com sucesso!');
                if (confirm('Deseja gerar o PDF da cotação?')) {
                    this.gerarPDF();
                }
            } else {
                alert('Erro ao salvar cotação: ' + (result.message || 'Tente novamente.'));
            }
        } catch (err) {
            alert('Erro ao salvar cotação: ' + err.message);
        }
    },

    /**
     * Gera PDF da cotação
     */
    gerarPDF() {
        if (!this.cotacaoAtual) return;

        const { nome, telefone } = this._lerDadosCliente();
        if (!nome) {
            alert('Informe o nome do cliente para gerar o PDF.');
            document.getElementById('cotacaoClienteNome')?.focus();
            return;
        }

        const dadosPDF = { ...this.cotacaoAtual };
        dadosPDF.cliente = { nome, telefone };
        dadosPDF.formaPagamento = this.cotacaoAtual.formaPagamento || null;
        dadosPDF.subtipoCartao = this.cotacaoAtual.subtipoCartao || null;
        dadosPDF.parcelasSelecionadas = this.cotacaoAtual.parcelasSelecionadas || null;

        const valores = this.cotacaoAtual.valoresPersonalizados || {};
        dadosPDF.precos = {
            ...dadosPDF.precos,
            valorPorPessoa: valores.valorPorPessoa != null ? valores.valorPorPessoa : dadosPDF.precos.valorPorPessoa,
            taxaPorPessoa:  valores.taxaPorPessoa  != null ? valores.taxaPorPessoa  : dadosPDF.precos.taxaPorPessoa,
            subtotalVoos:   valores.valorPorPessoa != null
                ? (valores.valorPorPessoa * dadosPDF.precos.totalPax)
                : dadosPDF.precos.subtotalVoos,
            taxaEmbarque:   valores.taxaPorPessoa  != null
                ? (valores.taxaPorPessoa * dadosPDF.precos.totalPax)
                : dadosPDF.precos.taxaEmbarque,
            total:          valores.total != null ? valores.total : dadosPDF.precos.total,
            qtdBagagens:    valores.qtdBagagens  || 0,
            valorBagagem:   valores.valorBagagem || 0
        };

        if (!dadosPDF.validade) {
            const validade = new Date();
            validade.setDate(validade.getDate() + CONFIG.cotacao.validadeDias);
            dadosPDF.validade = validade.toISOString();
        }

        ReportModule.gerarCotacaoPDF(dadosPDF);
    },

    /**
     * Carrega cotação existente
     */
    carregarCotacao(id) {
        const cotacao = Storage.getCotacaoById(id);
        if (!cotacao) {
            alert('Cotação não encontrada');
            return;
        }

        const cliente = Storage.getClienteById(cotacao.clienteId);

        this.cotacaoAtual = {
            id: cotacao.id,
            voos: cotacao.voos,
            passageiros: cotacao.passageiros,
            clienteId: cotacao.clienteId,
            cliente: cliente,
            precos: {
                subtotal: cotacao.subtotal,
                taxas: cotacao.taxas,
                total: cotacao.total
            },
            status: cotacao.status,
            validade: cotacao.validade,
            dataCriacao: cotacao.dataCriacao,
            salva: true
        };

        this.render();
    }
};

// Exportar para uso global
window.QuotationModule = QuotationModule;
