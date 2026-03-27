const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const resolveDbClient = () => {
  const explicit = String(process.env.DB_CLIENT || "").trim().toLowerCase();
  if (explicit === "mysql") return "mysql";
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "postgres" || explicit === "postgresql") return "postgres";
  if (process.env.DATABASE_URL) return "postgres";
  if (process.env.NODE_ENV === "production") return "postgres";
  return "sqlite";
};

const dbClient = resolveDbClient();
let sqliteDb;
let mysqlPool;
let pgPool;

const toDriverSql = (sql) => {
  if (dbClient === "postgres") {
    let idx = 0;
    return sql.replace(/\?/g, () => {
      idx += 1;
      return `$${idx}`;
    });
  }
  return sql;
};

const setupConnection = async () => {
  if (dbClient === "sqlite") {
    let sqlite3;
    try {
      sqlite3 = require("sqlite3").verbose();
    } catch (_err) {
      throw new Error(
        "SQLite modu icin 'npm install sqlite3' gerekir (yerel gelistirme). Production icin DATABASE_URL veya DB_CLIENT=postgres kullanin."
      );
    }
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, "blog.db");
    sqliteDb = new sqlite3.Database(dbPath);
    return;
  }

  if (dbClient === "mysql") {
    mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "website_blog",
      connectionLimit: 10,
    });
    return;
  }

  if (dbClient === "postgres") {
    const connUrl = process.env.DATABASE_URL;
    if (connUrl) {
      pgPool = new Pool({
        connectionString: connUrl,
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : undefined,
      });
    } else {
      pgPool = new Pool({
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "website_blog",
      });
    }
    return;
  }

  throw new Error(`Unsupported DB_CLIENT: ${dbClient}`);
};

const run = async (sql, params = []) => {
  if (dbClient === "sqlite") {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function onRun(err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }
  if (dbClient === "mysql") {
    const [result] = await mysqlPool.execute(sql, params);
    return result;
  }
  const result = await pgPool.query(toDriverSql(sql), params);
  return result;
};

const get = async (sql, params = []) => {
  if (dbClient === "sqlite") {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
  if (dbClient === "mysql") {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows[0];
  }
  const result = await pgPool.query(toDriverSql(sql), params);
  return result.rows[0];
};

const all = async (sql, params = []) => {
  if (dbClient === "sqlite") {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
  if (dbClient === "mysql") {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  }
  const result = await pgPool.query(toDriverSql(sql), params);
  return result.rows;
};

const initTablesSql = () => {
  if (dbClient === "sqlite") {
    return [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email_verified INTEGER NOT NULL DEFAULT 0,
        verify_token TEXT,
        reset_token TEXT,
        reset_expires_at TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        published INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ];
  }

  if (dbClient === "mysql") {
    return [
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email_verified TINYINT(1) NOT NULL DEFAULT 0,
        verify_token VARCHAR(255) NULL,
        reset_token VARCHAR(255) NULL,
        reset_expires_at TIMESTAMP NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT NULL,
        published TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS site_settings (
        \`key\` VARCHAR(120) PRIMARY KEY,
        \`value\` TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ];
  }

  return [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verify_token VARCHAR(255),
      reset_token VARCHAR(255),
      reset_expires_at TIMESTAMP NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS site_settings (
      key VARCHAR(120) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
};

const initDb = async () => {
  await setupConnection();
  const statements = initTablesSql();
  for (const statement of statements) {
    await run(statement);
  }

  const safeRun = async (statement) => {
    try {
      await run(statement);
    } catch (_err) {
      // Existing columns or incompatible statements are ignored intentionally.
    }
  };

  if (dbClient === "sqlite") {
    await safeRun("ALTER TABLE users ADD COLUMN email TEXT");
    await safeRun("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
    await safeRun("ALTER TABLE users ADD COLUMN verify_token TEXT");
    await safeRun("ALTER TABLE users ADD COLUMN reset_token TEXT");
    await safeRun("ALTER TABLE users ADD COLUMN reset_expires_at TEXT");
    await safeRun("ALTER TABLE comments ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
    await safeRun("ALTER TABLE posts ADD COLUMN image_url TEXT");
    await safeRun("UPDATE comments SET status = 'approved' WHERE status IS NULL OR status = ''");
  } else if (dbClient === "mysql") {
    await safeRun("ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL");
    await safeRun("ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0");
    await safeRun("ALTER TABLE users ADD COLUMN verify_token VARCHAR(255) NULL");
    await safeRun("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL");
    await safeRun("ALTER TABLE users ADD COLUMN reset_expires_at TIMESTAMP NULL");
    await safeRun("ALTER TABLE comments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'");
    await safeRun("ALTER TABLE posts ADD COLUMN image_url TEXT NULL");
    await safeRun("UPDATE comments SET status = 'approved' WHERE status IS NULL OR status = ''");
  } else {
    await safeRun("ALTER TABLE users ADD COLUMN email VARCHAR(255)");
    await safeRun("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE");
    await safeRun("ALTER TABLE users ADD COLUMN verify_token VARCHAR(255)");
    await safeRun("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255)");
    await safeRun("ALTER TABLE users ADD COLUMN reset_expires_at TIMESTAMP NULL");
    await safeRun("ALTER TABLE comments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'");
    await safeRun("ALTER TABLE posts ADD COLUMN image_url TEXT");
    await safeRun("UPDATE comments SET status = 'approved' WHERE status IS NULL OR status = ''");
  }

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

  const existingAdmin = await get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!existingAdmin) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await run(
      "INSERT INTO users (username, email, password_hash, email_verified, role) VALUES (?, ?, ?, ?, 'admin')",
      [adminUsername, adminEmail, hash, 1]
    );
    // eslint-disable-next-line no-console
    console.log(`Admin kullanici olusturuldu: ${adminUsername}`);
  }
};

module.exports = { run, get, all, initDb, dbClient };
