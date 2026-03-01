const mysql = require('mysql2/promise');
require('dotenv').config();

const MYSQL_CONFIG = {
    host: process.env.DB_HOST || 'srv1659.hstgr.io',
    user: process.env.DB_USER || 'u482302128_us_appgetmidia',
    database: process.env.DB_NAME || 'u482302128_appgetmidia',
    password: process.env.DB_PASSWORD || 'Lucajucam1#',
    connectTimeout: 15000 // 15 seconds
};

async function test() {
    console.log("Testando conexão com MySQL em getmidia.com.br...");
    try {
        const connection = await mysql.createConnection(MYSQL_CONFIG);
        console.log("SUCESSO: Conectado ao MySQL!");
        await connection.end();
    } catch (err) {
        console.error("ERRO DE CONEXÃO:", err.message);
        if (err.code === 'ETIMEDOUT') {
            console.log("\nPossível causa: A Hostinger bloqueia conexões remotas por padrão.");
            console.log("Sugestão: Verifique se o IP está liberado em 'Remote MySQL' no painel da Hostinger.");
        }
    }
}

test();
