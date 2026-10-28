// GiraMundoTour - Datas de viagem
//
// Campos <input type="date"> marcados com:
//   data-sem-passado      → não aceitam data anterior a hoje
//   data-apos="<id ida>"  → volta/check-out: mínimo é a data da ida e, ao escolher
//                           a ida, o calendário da volta abre sozinho já no mês dela
//
// Funciona por delegação no document, então vale também para campos criados
// depois (modais, cards de serviço re-renderizados).

const DatasViagem = {
    hoje() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _vigiado(el) {
        return el instanceof HTMLInputElement && el.type === 'date'
            && ('semPassado' in el.dataset || 'apos' in el.dataset);
    },

    // Menor data permitida: hoje, ou a data da ida quando ela for posterior.
    // Sem data-apos, respeita um mínimo mais restrito que o próprio módulo já definiu
    // (ex.: Monitoramento encadeia ida/volta por conta própria).
    _minDe(el) {
        let min = this.hoje();
        if (!el.dataset.apos && el.min > min) return el.min;
        const ida = el.dataset.apos && document.getElementById(el.dataset.apos);
        if (ida?.value && ida.value > min) min = ida.value;
        return min;
    },

    _aplicarMin(el) {
        if (this._vigiado(el)) el.min = this._minDe(el);
    },

    _fmt(iso) {
        const [a, m, d] = iso.split('-');
        return `${d}/${m}/${a}`;
    },

    _onChange(el) {
        if (!this._vigiado(el) || !el.value) return;

        // Data digitada à mão fora do limite (o calendário já não deixa escolher)
        const min = this._minDe(el);
        if (el.value < min) {
            el.value = '';
            if (typeof App !== 'undefined') App.showToast(`Escolha uma data a partir de ${this._fmt(min)}`, 'warning');
            el.dispatchEvent(new Event('change', { bubbles: true }));   // avisa o módulo que o campo esvaziou
            return;
        }

        if (!el.id) return;
        const voltas = [...document.querySelectorAll(`input[type="date"][data-apos="${CSS.escape(el.id)}"]`)];
        voltas.forEach(v => {
            v.min = this._minDe(v);
            if (v.value && v.value < el.value) {
                v.value = '';
                v.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Abre o calendário da volta (só a visível e ainda vazia)
        const prox = voltas.find(v => !v.value && !v.disabled && v.offsetParent !== null);
        if (prox) {
            prox.min = this._minDe(prox);
            try { prox.showPicker(); } catch (_) { prox.focus(); }
        }
    },

    init() {
        // focusin cobre teclado; pointerdown cobre o clique direto no ícone do calendário
        document.addEventListener('focusin',     e => this._aplicarMin(e.target));
        document.addEventListener('pointerdown', e => this._aplicarMin(e.target), true);
        document.addEventListener('change',      e => this._onChange(e.target));
    },
};

DatasViagem.init();
window.DatasViagem = DatasViagem;
