// GiraMundoTour - Módulo de Busca de Voos

const SearchModule = {
    resultados: null,
    voosSelecionados: { ida: null, volta: null },

    init() {
        this.bindEvents();
        this.initAutocomplete();
        this.preencherUltimaBusca();
        this.limparCacheAntigo();
        debugLog('SearchModule: Inicializado');
    },

    limparCacheAntigo() {
        try {
            localStorage.removeItem(CONFIG.storageKeys.buscaCache);
        } catch (e) { /* ignore */ }
    },

    bindEvents() {
        const form = document.getElementById('searchForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.executarBusca();
            });
        }

        const tipoViagem = document.querySelectorAll('input[name="tipoViagem"]');
        tipoViagem.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const dataVoltaGroup = document.getElementById('dataVoltaGroup');
                if (e.target.value === 'ida') {
                    dataVoltaGroup.classList.add('d-none');
                    document.getElementById('dataVolta').value = '';
                } else {
                    dataVoltaGroup.classList.remove('d-none');
                }
            });
        });

        document.getElementById('filtroCompanhia')?.addEventListener('change', () => this.aplicarFiltros());
        document.getElementById('filtroEscalas')?.addEventListener('change', () => this.aplicarFiltros());
        document.getElementById('ordenacao')?.addEventListener('change', () => this.aplicarFiltros());

        const hoje = Formatter.dateForInput(new Date());
        document.getElementById('dataIda')?.setAttribute('min', hoje);
        document.getElementById('dataVolta')?.setAttribute('min', hoje);

        document.getElementById('dataIda')?.addEventListener('change', (e) => {
            const dataVolta = document.getElementById('dataVolta');
            if (dataVolta) {
                dataVolta.setAttribute('min', e.target.value);
                // Se data de volta já está preenchida com data menor, limpa
                if (dataVolta.value && dataVolta.value < e.target.value) {
                    dataVolta.value = '';
                }
            }
            // Abre o calendário de volta automaticamente ao selecionar ida e volta
            const tipoViagem = document.querySelector('input[name="tipoViagem"]:checked')?.value;
            if (tipoViagem === 'idaVolta' && dataVolta && !dataVolta.value) {
                try { dataVolta.showPicker(); } catch (err) { dataVolta.focus(); }
            }
        });
    },

    initAutocomplete() {
        const origemInput = document.getElementById('origem');
        const destinoInput = document.getElementById('destino');
        if (origemInput) this.setupAutocomplete(origemInput, 'origemCode');
        if (destinoInput) this.setupAutocomplete(destinoInput, 'destinoCode');
    },

    setupAutocomplete(input, codeFieldId) {
        const container = input.parentElement;
        container.classList.add('autocomplete-container');

        let listElement = container.querySelector('.autocomplete-list');
        if (!listElement) {
            listElement = document.createElement('div');
            listElement.className = 'autocomplete-list';
            listElement.style.display = 'none';
            container.appendChild(listElement);
        }

        let debounceTimer;

        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = e.target.value;
                const resultados = searchAirports(query);
                this.mostrarSugestoes(listElement, resultados, input, codeFieldId);
            }, 200);
        });

        input.addEventListener('focus', (e) => {
            if (e.target.value.length >= 2) {
                const resultados = searchAirports(e.target.value);
                this.mostrarSugestoes(listElement, resultados, input, codeFieldId);
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => { listElement.style.display = 'none'; }, 200);
        });

        input.addEventListener('keydown', (e) => {
            const items = listElement.querySelectorAll('.autocomplete-item');
            const activeItem = listElement.querySelector('.autocomplete-item.active');
            let activeIndex = Array.from(items).indexOf(activeItem);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, items.length - 1);
                items.forEach((item, i) => item.classList.toggle('active', i === activeIndex));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                items.forEach((item, i) => item.classList.toggle('active', i === activeIndex));
            } else if (e.key === 'Enter' && activeItem) {
                e.preventDefault();
                activeItem.click();
            }
        });
    },

    mostrarSugestoes(listElement, aeroportos, input, codeFieldId) {
        if (aeroportos.length === 0) {
            listElement.style.display = 'none';
            return;
        }

        listElement.innerHTML = aeroportos.map((airport, i) => {
            if (airport.isCityGroup) {
                const codes = airport.airports.map(a => a.code).join(', ');
                return `
                    <div class="autocomplete-item autocomplete-city-group ${i === 0 ? 'active' : ''}" data-code="${airport.code}">
                        <span class="airport-code"><i class="bi bi-buildings"></i></span>
                        <span class="airport-name">
                            <strong>${airport.city}</strong> — Todos os aeroportos
                            <small class="airport-codes-list">${codes}</small>
                        </span>
                    </div>
                `;
            }
            return `
                <div class="autocomplete-item ${i === 0 ? 'active' : ''}" data-code="${airport.code}">
                    <span class="airport-code">${airport.code}</span>
                    <span class="airport-name">${airport.city}, ${airport.country}</span>
                </div>
            `;
        }).join('');

        listElement.style.display = 'block';

        listElement.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.dataset.code;
                if (code.includes(',')) {
                    // Grupo de cidade — pega o primeiro aeroporto para obter o nome da cidade
                    const firstCode = code.split(',')[0].trim();
                    const airport = getAirportByCode(firstCode);
                    const metro = airport?.metro || airport?.city || firstCode;
                    input.value = `${metro} - Todos os aeroportos`;
                } else {
                    const airport = getAirportByCode(code);
                    input.value = `${airport.city} (${code})`;
                }
                document.getElementById(codeFieldId).value = code;
                listElement.style.display = 'none';
            });
        });
    },

    preencherUltimaBusca() {
        const ultimaBusca = Storage.getUltimaBusca();
        if (!ultimaBusca) return;

        const formatarCodigo = (codigoSalvo, inputId, codeId) => {
            if (!codigoSalvo) return;
            document.getElementById(codeId).value = codigoSalvo;
            if (codigoSalvo.includes(',')) {
                const firstCode = codigoSalvo.split(',')[0].trim();
                const airport = getAirportByCode(firstCode);
                const metro = airport?.metro || airport?.city || firstCode;
                document.getElementById(inputId).value = `${metro} - Todos os aeroportos`;
            } else {
                const airport = getAirportByCode(codigoSalvo);
                if (airport) document.getElementById(inputId).value = `${airport.city} (${airport.code})`;
            }
        };

        formatarCodigo(ultimaBusca.origem, 'origem', 'origemCode');
        formatarCodigo(ultimaBusca.destino, 'destino', 'destinoCode');
    },

    async executarBusca() {
        const params = this.getFormData();

        const validacao = Validators.searchForm(params);
        if (!validacao.valid) {
            Validators.showFormErrors(validacao.errors, document.getElementById('searchForm'));
            return;
        }

        Validators.clearFormErrors(document.getElementById('searchForm'));
        this.mostrarLoading(true);
        this.limparResultados();

        try {
            const resultados = await this.buscarViaAPI(params);

            if (!resultados.params) {
                resultados.params = params;
            }
            this.resultados = resultados;
            Storage.saveUltimaBusca(params);
            this.exibirResultados(resultados);

        } catch (error) {
            console.error('Erro na busca:', error);
            this.mostrarErro(error.message || 'Erro ao buscar voos. Por favor, tente novamente.');
        } finally {
            this.mostrarLoading(false);
        }
    },

    async buscarViaAPI(params) {
        const origens = params.origem.split(',').map(c => c.trim()).filter(Boolean);
        const destinos = params.destino.split(',').map(c => c.trim()).filter(Boolean);

        // Se for busca simples (1 origem × 1 destino), usa o fluxo direto
        if (origens.length === 1 && destinos.length === 1) {
            return this._buscarSimples({ ...params, origem: origens[0], destino: destinos[0] });
        }

        // Busca paralela para todas as combinações de aeroportos
        const combinacoes = [];
        for (const o of origens) {
            for (const d of destinos) {
                combinacoes.push({ ...params, origem: o, destino: d });
            }
        }

        const todos = await Promise.all(
            combinacoes.map(p => this._buscarSimples(p).catch(() => null))
        );

        // Mescla e deduplica por id do voo
        const merged = { ida: [], volta: [], fonte: 'desconhecido', params };
        const seenIds = new Set();
        todos.filter(Boolean).forEach(r => {
            if (r.fonte && r.fonte !== 'desconhecido') merged.fonte = r.fonte;
            (r.ida || []).forEach(v => { if (!seenIds.has(v.id)) { seenIds.add(v.id); merged.ida.push(v); } });
            (r.volta || []).forEach(v => { if (!seenIds.has(v.id)) { seenIds.add(v.id); merged.volta.push(v); } });
        });

        return merged;
    },

    async _buscarSimples(params) {
        const passageiros = params.passageiros || {};
        const queryParams = new URLSearchParams({
            origem: params.origem,
            destino: params.destino,
            dataIda: params.dataIda,
            adultos: passageiros.adultos || 1,
            criancas: passageiros.criancas || 0,
            bebes: passageiros.bebes || 0,
            classe: params.classe || 'economica'
        });

        if (params.dataVolta) {
            queryParams.append('dataVolta', params.dataVolta);
        }

        const response = await fetch(`/api/voos/buscar?${queryParams.toString()}`);
        if (!response.ok && response.status !== 200) {
            throw new Error(`Servidor retornou ${response.status}`);
        }
        const data = await response.json();

        if (data.success === false || data.error) {
            throw new Error(data.message || data.errors?.[0]?.msg || 'Parâmetros inválidos');
        }

        return this.converterResultadosAPI(data.data, params);
    },

    converterResultadosAPI(apiData, params) {
        const mapVoo = (voo, tipo) => {
            const cia   = voo.companhia || {};
            const ori   = voo.origem   || {};
            const dest  = voo.destino  || {};
            const part  = voo.partida  || {};
            const cheg  = voo.chegada  || {};
            const dur   = voo.duracao  || {};
            const preco = voo.preco    || {};
            return {
                id: voo.id,
                airline: cia.codigo || '',
                airlineName: cia.nome || cia.codigo || '',
                airlineColor: cia.cor || '#666666',
                flightNumber: voo.numero || '',
                origin: ori.codigo || '',
                originCity: ori.cidade || ori.codigo || '',
                destination: dest.codigo || '',
                destinationCity: dest.cidade || dest.codigo || '',
                departureTime: part.horario || '',
                arrivalTime: cheg.horario || '',
                departureDate: part.data || '',
                arrivalDate: cheg.data || '',
                duration: dur.total || 0,
                durationText: dur.texto || '',
                stops: voo.escalas ?? 0,
                price: preco.porPessoa || preco.valor || 0,
                currency: preco.moeda || 'BRL',
                seats: voo.assentos,
                class: voo.classe || 'economica',
                pontos: voo.pontos ? {
                    quantidade: voo.pontos.quantidade,
                    programa: voo.pontos.programa,
                    taxaEmbarque: voo.pontos.taxaEmbarque
                } : null,
                segmentos: voo.segmentos || undefined,
                tipo
            };
        };

        const fonte = apiData.meta?.fonte || 'desconhecido';
        return {
            ida:   (apiData.ida   || []).map(v => mapVoo(v, 'ida')),
            volta: (apiData.volta || []).map(v => mapVoo(v, 'volta')),
            fonte,
            params
        };
    },

    getFormData() {
        return {
            origem: document.getElementById('origemCode')?.value?.toUpperCase() || '',
            destino: document.getElementById('destinoCode')?.value?.toUpperCase() || '',
            dataIda: document.getElementById('dataIda')?.value || '',
            dataVolta: document.getElementById('dataVolta')?.value || '',
            tipoViagem: document.querySelector('input[name="tipoViagem"]:checked')?.value || 'idaVolta',
            passageiros: {
                adultos: parseInt(document.getElementById('adultos')?.value) || 1,
                criancas: parseInt(document.getElementById('criancas')?.value) || 0,
                bebes: parseInt(document.getElementById('bebes')?.value) || 0
            },
            classe: document.getElementById('classe')?.value || 'economica'
        };
    },

    /**
     * Exibe resultados inline na pagina de busca
     */
    exibirResultados(resultados) {
        const container = document.getElementById('resultadosContainer');
        if (!container) return;

        container.classList.remove('d-none');

        // Mostra filtros inline
        const filtrosCard = container.querySelector('.card.mb-4');
        if (filtrosCard) filtrosCard.classList.remove('d-none');

        this.popularFiltroCompanhias(resultados);
        this.atualizarContador(resultados);

        // Mostra secao de ida
        const voosIdaSection = document.getElementById('voosIda')?.parentElement;
        if (voosIdaSection) voosIdaSection.classList.remove('d-none');

        this.exibirVoos(resultados.ida, 'voosIda', 'ida');

        // Mostra secao de volta
        if (resultados.volta && resultados.volta.length > 0) {
            document.getElementById('voosVoltaSection')?.classList.remove('d-none');
            this.exibirVoos(resultados.volta, 'voosVolta', 'volta');
        } else {
            document.getElementById('voosVoltaSection')?.classList.add('d-none');
        }
    },

    /**
     * Exibe lista de voos em um container.
     * Se um voo ja foi selecionado para esse tipo, mostra apenas o selecionado + botao para alterar.
     */
    exibirVoos(voos, containerId, tipo) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!voos || voos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-airplane"></i>
                    <h4>Nenhum voo encontrado</h4>
                    <p>Tente alterar os filtros ou datas da busca</p>
                </div>
            `;
            return;
        }

        const selecionado = this.voosSelecionados[tipo];

        // Se tem voo selecionado, mostra apenas o card selecionado + botao alterar
        if (selecionado) {
            container.innerHTML = `
                <div class="flight-card selected" data-voo-id="${selecionado.id}">
                    ${this._renderFlightCardInner(selecionado, tipo, true)}
                </div>
                <div class="text-center mt-2 mb-3">
                    <button class="btn btn-outline-secondary btn-sm" id="btnAlterar_${tipo}">
                        <i class="bi bi-arrow-repeat me-1"></i> Alterar voo de ${tipo === 'ida' ? 'ida' : 'volta'} (${voos.length} opcoes)
                    </button>
                </div>
            `;
            document.getElementById(`btnAlterar_${tipo}`)?.addEventListener('click', () => {
                this.voosSelecionados[tipo] = null;
                this.exibirVoos(
                    tipo === 'ida' ? this.resultados.ida : this.resultados.volta,
                    containerId,
                    tipo
                );
                this.atualizarResumoSelecao();
            });
            return;
        }

        // Mostra todos os voos
        container.innerHTML = voos.map(voo => `
            <div class="flight-card" data-voo-id="${voo.id}">
                ${this._renderFlightCardInner(voo, tipo, false)}
            </div>
        `).join('');

        container.querySelectorAll('.btn-selecionar-voo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vooId = e.currentTarget.dataset.vooId;
                this.selecionarVoo(vooId, tipo);
            });
        });
    },

    /**
     * Renderiza conteudo interno do card de voo
     */
    _renderFlightCardInner(voo, tipo, selecionado) {
        // Normaliza schema: aceita formato atual (objeto aninhado) e legado (strings flat)
        const origemCode  = voo.origem?.codigo  || voo.origem  || voo.origin || '';
        const destinoCode = voo.destino?.codigo || voo.destino || voo.destination || '';
        const origemAirport  = getAirportByCode(origemCode);
        const destinoAirport = getAirportByCode(destinoCode);

        const companhiaCodigo = (voo.companhia?.codigo || voo.airline || voo.companhia || '').toString();
        const companhiaNome   = voo.companhia?.nome || voo.airlineName || voo.companhiaNome || getAirlineName(companhiaCodigo);
        const companhiaCor    = voo.companhia?.cor  || voo.airlineColor || voo.companhiaCor  || getAirlineColor(companhiaCodigo);
        const operadoPor      = voo.operadoPor || voo.operatedBy || null;
        const numeroVoo       = voo.numero || voo.flightNumber || voo.numeroVoo || '';

        const precoValor   = voo.preco?.valor    ?? voo.price ?? 0;
        const duracaoMin   = voo.duracao?.total  ?? voo.duration ?? 0;
        const duracaoTexto = voo.duracao?.texto  || voo.durationText || Formatter.duration(duracaoMin);
        const escalas      = voo.escalas ?? voo.stops ?? 0;

        const departureTime = voo.partida?.horario || voo.departureTime || Formatter.time(voo.dataPartida) || '';
        const arrivalTime   = voo.chegada?.horario || voo.arrivalTime   || Formatter.time(voo.dataChegada) || '';
        const departureDate = Formatter.date(voo.partida?.data || voo.dataPartida || voo.departureDate || '');

        const origemCidade  = voo.origem?.cidade  || voo.originCity      || origemAirport?.city  || '';
        const destinoCidade = voo.destino?.cidade || voo.destinationCity || destinoAirport?.city || '';
        const assentos = voo.assentos || voo.seats || voo.assentosDisponiveis || 9;

        // expõe para o resto do template
        const origem = origemCode, destino = destinoCode, preco = precoValor, duracao = duracaoMin;
        const companhia = companhiaCodigo;

        let pontosHtml = '';
        if (voo.pontos) {
            pontosHtml = `
                <div class="flight-points mt-2">
                    <span class="badge bg-warning text-dark">
                        <i class="bi bi-star-fill"></i>
                        ${Formatter.number(voo.pontos.quantidade)} pts
                    </span>
                    <small class="d-block text-muted" style="font-size: 0.7rem;">
                        ${voo.pontos.programa}
                        ${voo.pontos.taxaEmbarque > 0 ? '+ taxa' : ''}
                    </small>
                </div>
            `;
        }

        return `
            <div class="row align-items-center">
                <div class="col-md-2 text-center mb-3 mb-md-0">
                    <div class="airline-logo-placeholder" style="background-color: ${companhiaCor}; width: 48px; height: 48px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin: 0 auto;">
                        ${getAirlineInitials(companhia)}
                    </div>
                    <div class="airline-name mt-2">${companhiaNome}</div>
                    <small class="text-muted">${numeroVoo}</small>
                    ${operadoPor ? `<small class="d-block text-muted" style="font-size:0.7rem;"><i class="bi bi-info-circle"></i> operado por ${operadoPor.nome || operadoPor.codigo}</small>` : ''}
                </div>

                <div class="col-md-5">
                    <div class="flight-route">
                        <div class="text-center">
                            <div class="flight-time">${departureTime}</div>
                            <div class="flight-airport">${origem}</div>
                            <small class="text-muted">${origemCidade}</small>
                        </div>

                        <div class="flight-arrow">
                            <div class="flight-duration">${duracaoTexto}</div>
                            <i class="bi bi-airplane"></i>
                            <div class="flight-stops ${escalas === 0 ? 'direct' : ''}">
                                ${Formatter.stops(escalas)}
                            </div>
                        </div>

                        <div class="text-center">
                            <div class="flight-time">${arrivalTime}</div>
                            <div class="flight-airport">${destino}</div>
                            <small class="text-muted">${destinoCidade}</small>
                        </div>
                    </div>
                </div>

                <div class="col-md-3 text-center">
                    <div class="flight-price">${Formatter.currency(preco)}</div>
                    <div class="flight-price-label">por pessoa</div>
                    ${departureDate ? `<small class="text-muted d-block mt-1"><i class="bi bi-calendar3 me-1"></i>${departureDate}</small>` : ''}
                    ${pontosHtml}
                </div>

                <div class="col-md-2 text-center">
                    ${selecionado
                        ? '<span class="btn btn-success w-100 disabled"><i class="bi bi-check-lg"></i> Selecionado</span>'
                        : `<button class="btn btn-primary btn-selecionar-voo w-100" data-voo-id="${voo.id}">Selecionar</button>`
                    }
                    <small class="text-muted d-block mt-1">
                        ${assentos} lugares
                    </small>
                </div>
            </div>
        `;
    },

    selecionarVoo(vooId, tipo) {
        const voos = tipo === 'ida' ? this.resultados.ida : this.resultados.volta;
        const voo = voos.find(v => v.id === vooId);
        if (!voo) return;

        this.voosSelecionados[tipo] = voo;

        // Re-renderiza apenas a lista deste tipo (colapsa para mostrar so o selecionado)
        this.exibirVoos(
            tipo === 'ida' ? this.resultados.ida : this.resultados.volta,
            tipo === 'ida' ? 'voosIda' : 'voosVolta',
            tipo
        );

        this.atualizarResumoSelecao();
    },

    atualizarResumoSelecao() {
        const resumoContainer = document.getElementById('resumoSelecao');
        if (!resumoContainer) return;

        const { ida, volta } = this.voosSelecionados;

        if (!ida && !volta) {
            resumoContainer.classList.add('d-none');
            return;
        }

        resumoContainer.classList.remove('d-none');

        const temVolta = this.resultados.volta && this.resultados.volta.length > 0;

        let html = '<div class="card"><div class="card-header"><i class="bi bi-cart-check"></i> Voos Selecionados</div><div class="card-body">';

        if (ida) {
            const companhiaNome = ida.airlineName || ida.companhiaNome || getAirlineName(ida.airline || ida.companhia);
            const numeroVoo = ida.flightNumber || ida.numeroVoo;
            const origem = ida.origin || ida.origem;
            const destino = ida.destination || ida.destino;
            const preco = ida.price || ida.preco;
            const dataPartida = ida.dataPartida || (ida.departureDate && ida.departureTime ? `${ida.departureDate}T${ida.departureTime}` : '');
            const dataHoraFormatada = dataPartida ? `${Formatter.date(dataPartida)} ${Formatter.time(dataPartida)}` : '';

            html += `
                <div class="mb-3">
                    <strong><i class="bi bi-arrow-right-circle text-primary me-1"></i> Ida:</strong> ${companhiaNome} ${numeroVoo}<br>
                    ${origem} > ${destino} | ${dataHoraFormatada}<br>
                    <span class="text-primary fw-bold">${Formatter.currency(preco)}</span> por pessoa
                </div>
            `;
        }

        if (volta) {
            const companhiaNome = volta.airlineName || volta.companhiaNome || getAirlineName(volta.airline || volta.companhia);
            const numeroVoo = volta.flightNumber || volta.numeroVoo;
            const origem = volta.origin || volta.origem;
            const destino = volta.destination || volta.destino;
            const preco = volta.price || volta.preco;
            const dataPartida = volta.dataPartida || (volta.departureDate && volta.departureTime ? `${volta.departureDate}T${volta.departureTime}` : '');
            const dataHoraFormatada = dataPartida ? `${Formatter.date(dataPartida)} ${Formatter.time(dataPartida)}` : '';

            html += `
                <div class="mb-3">
                    <strong><i class="bi bi-arrow-left-circle text-success me-1"></i> Volta:</strong> ${companhiaNome} ${numeroVoo}<br>
                    ${origem} > ${destino} | ${dataHoraFormatada}<br>
                    <span class="text-primary fw-bold">${Formatter.currency(preco)}</span> por pessoa
                </div>
            `;
        } else if (temVolta) {
            html += `
                <div class="mb-3">
                    <span class="text-muted"><i class="bi bi-arrow-left-circle me-1"></i> Selecione um voo de volta acima</span>
                </div>
            `;
        }

        const passageiros = this.resultados.params?.passageiros || { adultos: 1, criancas: 0, bebes: 0 };
        const totalPassageiros = (passageiros.adultos || 1) + (passageiros.criancas || 0) + (passageiros.bebes || 0);
        const precoIda = (ida?.price || ida?.preco) || 0;
        const precoVolta = (volta?.price || volta?.preco) || 0;
        const subtotal = (precoIda + precoVolta) * totalPassageiros;

        html += `
            <hr>
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>Subtotal</strong><br>
                    <small class="text-muted">${Formatter.passengers(passageiros)}</small>
                </div>
                <div class="text-end">
                    <span class="fs-4 fw-bold text-primary">${Formatter.currency(subtotal)}</span>
                </div>
            </div>
            <button class="btn btn-success btn-lg w-100 mt-3" onclick="SearchModule.criarCotacao()">
                <i class="bi bi-file-earmark-text"></i> Criar Cotacao
            </button>
        `;

        html += '</div></div>';
        resumoContainer.innerHTML = html;
    },

    criarCotacao() {
        if (!this.voosSelecionados.ida) {
            alert('Selecione pelo menos o voo de ida');
            return;
        }

        const normalizarVoo = (voo) => {
            // Já no formato plano correto
            if (typeof voo.companhia === 'string' && typeof voo.preco === 'number') return voo;

            // Extrai de formato aninhado (SerpAPI/Skyscanner: companhia/origem/preco como objetos)
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
        };

        const dadosCotacao = {
            voos: [normalizarVoo(this.voosSelecionados.ida)],
            passageiros: this.resultados.params?.passageiros
        };

        if (this.voosSelecionados.volta) {
            dadosCotacao.voos.push(normalizarVoo(this.voosSelecionados.volta));
        }

        QuotationModule.novaCotacao(dadosCotacao);
        App.navigate('cotacao');
    },

    popularFiltroCompanhias(resultados) {
        const select = document.getElementById('filtroCompanhia');
        if (!select) return;

        const companhias = new Map();
        [...(resultados.ida || []), ...(resultados.volta || [])].forEach(voo => {
            // companhia pode vir como objeto {codigo, nome} (API atual) ou string (legado)
            const code = (voo.companhia?.codigo || voo.airline || voo.companhia || '').toString().toUpperCase();
            if (!code || companhias.has(code)) return;
            const nome = voo.companhia?.nome || voo.airlineName || getAirlineName(code) || code;
            companhias.set(code, nome);
        });

        select.innerHTML = '<option value="">Todas as companhias</option>';
        Array.from(companhias.entries()).sort((a, b) => a[1].localeCompare(b[1])).forEach(([code, name]) => {
            select.innerHTML += `<option value="${code}">${name}</option>`;
        });
    },

    aplicarFiltros() {
        if (!this.resultados) return;

        const filtroCompanhia = document.getElementById('filtroCompanhia')?.value;
        const filtroEscalas = document.getElementById('filtroEscalas')?.value;
        const ordenacao = document.getElementById('ordenacao')?.value;

        // Limpa selecao ao alterar filtros
        this.voosSelecionados = { ida: null, volta: null };

        let voosIdaFiltrados = [...this.resultados.ida];
        let voosVoltaFiltrados = [...(this.resultados.volta || [])];

        if (filtroCompanhia) {
            const ciaCode = (v) => (v.companhia?.codigo || v.airline || v.companhia || '').toString().toUpperCase();
            voosIdaFiltrados   = voosIdaFiltrados.filter(v => ciaCode(v) === filtroCompanhia.toUpperCase());
            voosVoltaFiltrados = voosVoltaFiltrados.filter(v => ciaCode(v) === filtroCompanhia.toUpperCase());
        }

        if (filtroEscalas !== '' && filtroEscalas !== undefined) {
            const maxEscalas = parseInt(filtroEscalas);
            voosIdaFiltrados   = voosIdaFiltrados.filter(v => (v.escalas ?? v.stops ?? 0) <= maxEscalas);
            voosVoltaFiltrados = voosVoltaFiltrados.filter(v => (v.escalas ?? v.stops ?? 0) <= maxEscalas);
        }

        const ordenar = (voos) => {
            const preco   = v => v.preco?.valor    ?? v.price         ?? 0;
            const duracao = v => v.duracao?.total  ?? v.duration      ?? 0;
            const partida = v => v.partida?.horario ?? v.departureTime ?? '';
            switch (ordenacao) {
                case 'preco':    return voos.sort((a, b) => preco(a)   - preco(b));
                case 'duracao':  return voos.sort((a, b) => duracao(a) - duracao(b));
                case 'partida':  return voos.sort((a, b) => partida(a).localeCompare(partida(b)));
                default:         return voos;
            }
        };

        voosIdaFiltrados = ordenar(voosIdaFiltrados);
        voosVoltaFiltrados = ordenar(voosVoltaFiltrados);

        const contador = document.getElementById('contadorResultados');
        if (contador) {
            contador.textContent = `${voosIdaFiltrados.length} voos de ida${voosVoltaFiltrados.length > 0 ? ` e ${voosVoltaFiltrados.length} de volta` : ''} encontrados`;
        }

        this.exibirVoos(voosIdaFiltrados, 'voosIda', 'ida');
        if (voosVoltaFiltrados.length > 0) {
            this.exibirVoos(voosVoltaFiltrados, 'voosVolta', 'volta');
        }

        document.getElementById('resumoSelecao')?.classList.add('d-none');
    },

    atualizarContador(resultados) {
        const contador = document.getElementById('contadorResultados');
        if (!contador) return;
        const totalIda = resultados.ida?.length || 0;
        const totalVolta = resultados.volta?.length || 0;

        const fonteMap = {
            'google_flights': { label: 'Google Flights', cor: '#1a73e8', icon: 'bi-google' },
            'skyscanner':     { label: 'Skyscanner',     cor: '#0770e3', icon: 'bi-airplane' },
            'amadeus':        { label: 'Amadeus',        cor: '#00843d', icon: 'bi-airplane' },
            'kiwi':           { label: 'Kiwi.com',       cor: '#e5463e', icon: 'bi-airplane' },
            'simulado':       { label: 'Dados Simulados', cor: '#f59e0b', icon: 'bi-exclamation-triangle-fill' },
        };
        const fonteInfo = fonteMap[resultados.fonte] || { label: resultados.fonte || 'Desconhecido', cor: '#6c757d', icon: 'bi-airplane' };
        const isSimulado = resultados.fonte === 'simulado' || !resultados.fonte;
        const badgeBg = isSimulado ? '#fff3cd' : '#d1e7dd';
        const badgeBorder = isSimulado ? '#ffc107' : '#0f5132';
        const badgeText = isSimulado ? '#856404' : '#0f5132';

        contador.innerHTML = `
            <span>${totalIda} voos de ida${totalVolta > 0 ? ` e ${totalVolta} de volta` : ''} encontrados</span>
            <span style="margin-left:10px;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;
                         background:${badgeBg};border:1px solid ${badgeBorder};color:${badgeText}">
                <i class="bi ${fonteInfo.icon} me-1"></i>${fonteInfo.label}
            </span>
            ${isSimulado ? '<small class="text-muted d-block mt-1" style="font-size:10px">⚠️ Dados simulados — não representam voos reais disponíveis</small>' : ''}
        `;
    },

    mostrarLoading(show) {
        const loading = document.getElementById('loadingBusca');
        const btnBuscar = document.getElementById('btnBuscar');

        if (loading) loading.classList.toggle('d-none', !show);

        if (btnBuscar) {
            btnBuscar.disabled = show;
            btnBuscar.innerHTML = show
                ? '<span class="loading-spinner me-2"></span> Buscando...'
                : '<i class="bi bi-search"></i> Buscar Voos';
        }
    },

    limparResultados() {
        this.resultados = null;
        this.voosSelecionados = { ida: null, volta: null };
        document.getElementById('voosIda')?.replaceChildren();
        document.getElementById('voosVolta')?.replaceChildren();
        document.getElementById('resumoSelecao')?.classList.add('d-none');
    },

    mostrarErro(mensagem) {
        const container = document.getElementById('resultadosContainer');
        if (!container) return;
        container.classList.remove('d-none');
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${mensagem}
            </div>
        `;
    }
};

window.SearchModule = SearchModule;
