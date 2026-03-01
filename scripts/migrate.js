const { createClient } = require('@supabase/supabase-js');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Configurações (Substitua se necessário ou use variáveis de ambiente)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qyruweidqlqniqdatnxx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Requerido para migrar auth.users

const MYSQL_CONFIG = {
    host: process.env.DB_HOST || 'srv1659.hstgr.io',
    user: process.env.DB_USER || 'u482302128_us_appgetmidia',
    database: process.env.DB_NAME || 'u482302128_appgetmidia',
    password: process.env.DB_PASSWORD || 'Lucajucam1#',
};

async function migrate() {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada. Ela é necessária para migrar usuários e senhas.");
        console.log("Por favor, adicione-a ao seu .env ou edite este script.");
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const connection = await mysql.createConnection(MYSQL_CONFIG);

    console.log("Conectado ao Supabase e MySQL. Iniciando migração...");

    try {
        // 1. Migrar Usuários (auth.users -> users)
        console.log("Migrando usuários...");
        const { data: authUsers, error: userError } = await supabase.auth.admin.listUsers();
        if (userError) throw userError;

        for (const user of authUsers.users) {
            // Nota: Não conseguimos pegar a senha em texto plano do Supabase.
            // O ideal seria importar o hash, mas o formato do hash do Supabase (GoTrue) 
            // pode ser diferente do que o bcrypt espera.
            // Como fallback, criaremos uma senha temporária ou o usuário terá que resetar.
            // Se o hash for compatível, podemos tentar inseri-lo.
            await connection.execute(
                'INSERT IGNORE INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
                [user.id, user.email, '$2a$10$legacy_hash_placeholder', user.created_at]
            );
        }
        console.log(`- ${authUsers.users.length} usuários migrados.`);

        // 2. Migrar Perfis (public.profiles -> profiles)
        console.log("Migrando perfis...");
        const { data: profiles, error: profileError } = await supabase.from('profiles').select('*');
        if (profileError) throw profileError;

        for (const p of profiles) {
            await connection.execute(
                `INSERT IGNORE INTO profiles (
                    id, full_name, phone, whatsapp, cpf_cnpj, credits, 
                    plan, plan_id, subscription_status, subscription_start, 
                    current_period_end, payment_method
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    p.id, p.full_name, p.phone, p.whatsapp, p.cpf_cnpj, p.credits || 0,
                    p.plan || 'free', p.plan_id, p.subscription_status || 'inactive',
                    p.subscription_start, p.current_period_end, p.payment_method
                ]
            );
        }
        console.log(`- ${profiles.length} perfis migrados.`);

        // 3. Migrar Tickets
        console.log("Migrando tickets...");
        const { data: tickets, error: ticketError } = await supabase.from('tickets').select('*');
        if (ticketError) {
            console.warn("Aviso: Tabela 'tickets' não encontrada ou erro:", ticketError.message);
        } else {
            for (const t of tickets) {
                await connection.execute(
                    'INSERT IGNORE INTO tickets (id, user_id, type, status, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [t.id, t.user_id, t.type, t.status, t.description, t.created_at]
                );
            }
            console.log(`- ${tickets.length} tickets migrados.`);
        }

        // 4. Migrar Imagens da Galeria (site_gallery_images)
        console.log("Migrando galeria do site...");
        const { data: siteGallery, error: sgError } = await supabase.from('site_gallery_images').select('*');
        if (sgError) {
            console.warn("Aviso: Tabela 'site_gallery_images' não encontrada.");
        } else {
            for (const img of siteGallery) {
                await connection.execute(
                    'INSERT IGNORE INTO site_gallery_images (page_slug, image_url, title, description, display_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [img.page_slug, img.image_url, img.title, img.description, img.display_order, img.created_at]
                );
            }
            console.log(`- ${siteGallery.length} imagens de galeria migradas.`);
        }

        // 5. Migrar Imagens Reportadas
        console.log("Migrando imagens reportadas...");
        const { data: reported, error: repError } = await supabase.from('reported_images').select('*');
        if (!repError) {
            for (const r of reported) {
                await connection.execute(
                    'INSERT IGNORE INTO reported_images (image_url, image_path, user_id, reason, cost, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [r.image_url, r.image_path, r.user_id, r.reason, r.cost, r.status, r.created_at]
                );
            }
            console.log(`- ${reported.length} registros de reporte migrados.`);
        }

        console.log("\n>>> MIGRAÇÃO DE DADOS CONCLUÍDA COM SUCESSO! <<<");
        console.log("Próximo passo sugerido: Baixar as imagens do Supabase Storage e colocar na pasta /uploads/");

    } catch (err) {
        console.error("ERRO DURANTE A MIGRAÇÃO:", err);
    } finally {
        await connection.end();
    }
}

migrate();
