const jwt = require('jsonwebtoken');
const freshToken = jwt.sign(
    { id: '2d097383-2831-481c-9b4b-f3c98e5b1dae', email: 'operador@giramundotour.com.br', perfil: 'operador' },
    'giramundotour_jwt_secret_key_2024_altere_em_producao',
    { expiresIn: '2h' }
);

(async () => {
    console.log('Executando diagnóstico GOL no servidor...\n');
    const res = await fetch('https://giramundotour.onrender.com/api/reservas/debug-gol', {
        headers: { 'Authorization': 'Bearer ' + freshToken }
    });
    const text = await res.text();
    console.log(text);
})();
