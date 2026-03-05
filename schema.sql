-- MySQL Schema for GetMídia Migration

-- 1. Users table (Replacing Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY, -- UUID
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Profiles table (User details, credits, and plans)
CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) PRIMARY KEY,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    cpf_cnpj VARCHAR(20),
    credits INT DEFAULT 0,
    plan VARCHAR(50) DEFAULT 'free',
    plan_id VARCHAR(100),
    subscription_status VARCHAR(20) DEFAULT 'inactive',
    subscription_start DATETIME,
    current_period_end DATETIME,
    payment_method VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Tickets table (Support and cancellation)
CREATE TABLE IF NOT EXISTS tickets (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'cancellation', 'support', etc.
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'resolved', 'closed'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Galleries table (Saved items)
CREATE TABLE IF NOT EXISTS galleries (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Gallery Items
CREATE TABLE IF NOT EXISTS gallery_items (
    id CHAR(36) PRIMARY KEY,
    gallery_id CHAR(36) NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
);
-- 6. Module Config (Colors and Labels)
CREATE TABLE IF NOT EXISTS module_config (
    module_mode VARCHAR(50) PRIMARY KEY,
    primary_color VARCHAR(10) NOT NULL,
    label VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- 7. Site Gallery Images
CREATE TABLE IF NOT EXISTS site_gallery_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    page_slug VARCHAR(100) NOT NULL,
    image_url TEXT NOT NULL,
    title VARCHAR(255),
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Reported Images
CREATE TABLE IF NOT EXISTS reported_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_url TEXT NOT NULL,
    image_path VARCHAR(255),
    user_id CHAR(36) NOT NULL,
    reason TEXT,
    cost INT DEFAULT 1,
    status ENUM('pending', 'resolved', 'dismissed', 'refunded', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. Subscription History
CREATE TABLE IF NOT EXISTS subscription_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    action VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
