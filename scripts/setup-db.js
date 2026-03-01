const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MYSQL_CONFIG = {
    host: process.env.DB_HOST || 'srv1659.hstgr.io',
    user: process.env.DB_USER || 'u482302128_us_appgetmidia',
    database: process.env.DB_NAME || 'u482302128_appgetmidia',
    password: process.env.DB_PASSWORD, // Lído do .env corrigido com aspas
    multipleStatements: true
};

async function setup() {
    console.log("Iniciando criação do schema no MySQL Remoto...");

    // Caminho absoluto para o arquivo SQL
    const schemaPath = 'C:\\Users\\julio\\.gemini\\antigravity\\brain\\e0f440ea-65c7-48d0-b285-829a03ba957b\\mysql_schema.sql';

    if (!fs.existsSync(schemaPath)) {
        console.error("ERRO: Arquivo mysql_schema.sql não encontrado em:", schemaPath);
        return;
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    const connection = await mysql.createConnection(MYSQL_CONFIG);

    try {
        console.log("Executando scripts SQL...");
        await connection.query(sql);
        console.log("SUCESSO: Tabelas criadas com sucesso!");
    } catch (err) {
        console.error("ERRO ao criar tabelas:", err.message);
    } finally {
        await connection.end();
    }
}

setup();
