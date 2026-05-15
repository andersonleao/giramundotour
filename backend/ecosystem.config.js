module.exports = {
    apps: [{
        name: 'giramundotour',
        script: 'src/server.js',
        cwd: '/var/www/giramundotour/backend',
        env: {
            NODE_ENV: 'production',
            DISPLAY: ':99'
        }
    }]
};
