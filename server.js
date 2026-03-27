const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const multer = require("multer");
const dotenv = require("dotenv");
const { initDb, get, all, run, dbClient } = require("./db");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const showDebugTokens = process.env.SHOW_DEBUG_TOKENS === "true";
const isProduction = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
if (isProduction) app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8,
      secure: isProduction,
      sameSite: isProduction ? "lax" : "strict",
    },
  })
);

app.use(express.static(__dirname));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Cok fazla giris denemesi. Lutfen daha sonra tekrar deneyin." },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Cok fazla yukleme denemesi. Biraz sonra tekrar deneyin." },
});

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
    cb(null, `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//i.test(String(file.mimetype || ""))) {
      cb(new Error("Sadece gorsel dosyalari yuklenebilir."));
      return;
    }
    cb(null, true);
  },
});

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(401).json({ message: "Yetkisiz erisim." });
  }
  next();
};

const requireUser = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: "Giris gerekli." });
  next();
};

const requireOnlyUser = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "user") {
    return res.status(401).json({ message: "Kullanici girisi gerekli." });
  }
  next();
};

const allowedSiteSettingKeys = new Set([
  "index_intro_text",
  "index_sidebar_about",
  "index_newsletter_text",
  "about_profile_title",
  "about_profile_text",
  "projects_hero_text",
  "projects_cards_json",
]);

const COMMENT_MAX_LENGTH = 500;
const COMMENT_MIN_INTERVAL_MS = 15000;
const COMMENT_WINDOW_MS = 10 * 60 * 1000;
const COMMENT_MAX_PER_WINDOW = 6;
const MAX_LINK_COUNT = 2;
const commentRateStore = new Map();
const commentDuplicateStore = new Map();
const COMMENT_DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

const countLinks = (text) => {
  const matches = String(text || "").match(/(https?:\/\/|www\.)/gi);
  return matches ? matches.length : 0;
};

const normalizeComment = (text) =>
  String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const getRateLimitKey = (userId, ipAddress) => `${String(userId)}|${String(ipAddress || "unknown")}`;

const isRateLimitedForComment = (userId, ipAddress) => {
  const now = Date.now();
  const key = getRateLimitKey(userId, ipAddress);
  const entry = commentRateStore.get(key);
  if (!entry) return { limited: false };

  const recentTimestamps = entry.timestamps.filter((ts) => now - ts <= COMMENT_WINDOW_MS);
  const lastAt = entry.lastAt || 0;
  const tooFrequent = now - lastAt < COMMENT_MIN_INTERVAL_MS;
  const overWindowQuota = recentTimestamps.length >= COMMENT_MAX_PER_WINDOW;

  commentRateStore.set(key, { lastAt, timestamps: recentTimestamps });
  if (!tooFrequent && !overWindowQuota) return { limited: false };

  const retryMs = tooFrequent ? COMMENT_MIN_INTERVAL_MS - (now - lastAt) : COMMENT_MIN_INTERVAL_MS;
  return { limited: true, retryAfterMs: Math.max(retryMs, 1000) };
};

const recordCommentAttempt = (userId, ipAddress) => {
  const now = Date.now();
  const key = getRateLimitKey(userId, ipAddress);
  const entry = commentRateStore.get(key) || { lastAt: 0, timestamps: [] };
  const timestamps = entry.timestamps.filter((ts) => now - ts <= COMMENT_WINDOW_MS);
  timestamps.push(now);
  commentRateStore.set(key, { lastAt: now, timestamps });
};

const isDuplicateComment = (userId, normalizedComment) => {
  const now = Date.now();
  const key = String(userId);
  const entry = commentDuplicateStore.get(key);
  if (!entry) return false;

  const recentHashes = entry.items.filter((item) => now - item.at <= COMMENT_DUPLICATE_WINDOW_MS);
  commentDuplicateStore.set(key, { items: recentHashes });
  return recentHashes.some((item) => item.value === normalizedComment);
};

const recordCommentContent = (userId, normalizedComment) => {
  const now = Date.now();
  const key = String(userId);
  const entry = commentDuplicateStore.get(key) || { items: [] };
  const recentItems = entry.items.filter((item) => now - item.at <= COMMENT_DUPLICATE_WINDOW_MS);
  recentItems.push({ value: normalizedComment, at: now });
  commentDuplicateStore.set(key, { items: recentItems });
};

const normalizeImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") || raw.startsWith("./")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return "";
};

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Kullanici adi ve sifre gerekli." });
    }

    const user = await get("SELECT id, username, password_hash, role FROM users WHERE username = ?", [
      username,
    ]);
    if (!user || user.role !== "admin") return res.status(401).json({ message: "Admin girisi gecersiz." });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Giris bilgileri hatali." });

    req.session.user = { id: user.id, username: user.username, role: user.role };
    return res.json({ ok: true, user: req.session.user });
  } catch (error) {
    return res.status(500).json({ message: "Sunucu hatasi." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  return res.json({ loggedIn: true, user: req.session.user });
});

app.get("/api/posts", async (_req, res) => {
  try {
    const posts = await all(
      "SELECT id, title, category, content, image_url, created_at FROM posts WHERE published = 1 ORDER BY id DESC"
    );
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Veriler alinamadi." });
  }
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const post = await get(
      "SELECT id, title, category, content, image_url, created_at FROM posts WHERE id = ? AND published = 1",
      [postId]
    );
    if (!post) return res.status(404).json({ message: "Yazi bulunamadi." });
    return res.json(post);
  } catch (error) {
    return res.status(500).json({ message: "Yazi getirilemedi." });
  }
});

app.get("/api/site-settings", async (_req, res) => {
  try {
    const rows = await all("SELECT key, value FROM site_settings");
    const settings = {};
    for (const row of rows) {
      if (allowedSiteSettingKeys.has(String(row.key))) settings[row.key] = row.value;
    }
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: "Site ayarlari alinamadi." });
  }
});

app.post("/api/users/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Tum alanlar zorunlu." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Sifre en az 6 karakter olmali." });
    }

    const exists = await get("SELECT id FROM users WHERE username = ? OR email = ?", [
      username.trim(),
      email.trim(),
    ]);
    if (exists) return res.status(409).json({ message: "Bu kullanici/email zaten kayitli." });

    const hash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(24).toString("hex");
    await run(
      "INSERT INTO users (username, email, password_hash, email_verified, verify_token, role) VALUES (?, ?, ?, 0, ?, 'user')",
      [username.trim(), email.trim(), hash, verifyToken]
    );

    const payload = {
      ok: true,
      message: "Kayit basarili. E-posta dogrulamasi gerekli.",
    };
    if (showDebugTokens) payload.verifyTokenPreview = verifyToken;
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Kayit olusturulamadi." });
  }
});

app.post("/api/users/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token gerekli." });
    const user = await get("SELECT id FROM users WHERE verify_token = ? AND role = 'user'", [token]);
    if (!user) return res.status(400).json({ message: "Gecersiz dogrulama tokeni." });
    await run("UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?", [user.id]);
    return res.json({ ok: true, message: "E-posta dogrulandi." });
  } catch (error) {
    return res.status(500).json({ message: "Dogrulama basarisiz." });
  }
});

app.post("/api/users/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await get(
      "SELECT id, username, email, password_hash, role, email_verified FROM users WHERE username = ? AND role = 'user'",
      [username]
    );
    if (!user) return res.status(401).json({ message: "Giris bilgileri hatali." });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Giris bilgileri hatali." });
    if (!user.email_verified) {
      return res.status(403).json({ message: "E-posta dogrulamasi yapilmamis." });
    }
    req.session.user = { id: user.id, username: user.username, email: user.email, role: "user" };
    return res.json({ ok: true, user: req.session.user });
  } catch (error) {
    return res.status(500).json({ message: "Sunucu hatasi." });
  }
});

app.post("/api/users/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/users/me", (req, res) => {
  if (!req.session.user || req.session.user.role !== "user") return res.json({ loggedIn: false });
  return res.json({ loggedIn: true, user: req.session.user });
});

app.post("/api/users/change-password", requireUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Tum alanlar zorunlu." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Yeni sifre en az 6 karakter olmali." });
    }
    const user = await get("SELECT id, password_hash FROM users WHERE id = ?", [req.session.user.id]);
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(400).json({ message: "Mevcut sifre hatali." });
    const hash = await bcrypt.hash(newPassword, 10);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.session.user.id]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Sifre guncellenemedi." });
  }
});

app.post("/api/users/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "E-posta gerekli." });
    const user = await get("SELECT id FROM users WHERE email = ? AND role = 'user'", [email.trim()]);
    if (!user) return res.json({ ok: true, message: "Eger hesap varsa sifre linki olusturuldu." });
    const resetToken = crypto.randomBytes(24).toString("hex");
    const expiryExpr =
      dbClient === "sqlite"
        ? "datetime('now', '+1 hour')"
        : dbClient === "mysql"
          ? "DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)"
          : "CURRENT_TIMESTAMP + INTERVAL '1 hour'";
    await run(`UPDATE users SET reset_token = ?, reset_expires_at = ${expiryExpr} WHERE id = ?`, [
      resetToken,
      user.id,
    ]);
    const payload = { ok: true, message: "Sifirlama islemi olusturuldu." };
    if (showDebugTokens) payload.resetTokenPreview = resetToken;
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Sifre sifirlama talebi olusturulamadi." });
  }
});

app.post("/api/users/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: "Token ve yeni sifre gerekli." });
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Yeni sifre en az 6 karakter olmali." });
    }
    const user = await get(
      "SELECT id FROM users WHERE reset_token = ? AND role = 'user' AND reset_expires_at > CURRENT_TIMESTAMP",
      [token]
    );
    if (!user) return res.status(400).json({ message: "Token gecersiz veya suresi dolmus." });
    const hash = await bcrypt.hash(newPassword, 10);
    await run(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?",
      [hash, user.id]
    );
    return res.json({ ok: true, message: "Sifre basariyla yenilendi." });
  } catch (error) {
    return res.status(500).json({ message: "Sifre yenilenemedi." });
  }
});

app.get("/api/posts/:id/comments", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const currentUserId = req.session.user?.id || null;
    const comments = currentUserId
      ? await all(
          `SELECT c.id, c.comment, c.created_at, c.user_id, c.status, u.username
           FROM comments c
           JOIN users u ON u.id = c.user_id
           WHERE c.post_id = ? AND (c.status = 'approved' OR c.user_id = ?)
           ORDER BY c.id DESC`,
          [postId, currentUserId]
        )
      : await all(
          `SELECT c.id, c.comment, c.created_at, c.user_id, c.status, u.username
           FROM comments c
           JOIN users u ON u.id = c.user_id
           WHERE c.post_id = ? AND c.status = 'approved'
           ORDER BY c.id DESC`,
          [postId]
        );
    res.json(
      comments.map((item) => ({
        ...item,
        isOwner: currentUserId ? Number(item.user_id) === Number(currentUserId) : false,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Yorumlar alinamadi." });
  }
});

app.post("/api/posts/:id/comments", requireOnlyUser, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const { comment } = req.body;
    const content = String(comment || "").trim();
    const normalized = normalizeComment(content);
    const ipAddress = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
    if (!content) {
      return res.status(400).json({ message: "Yorum bos olamaz." });
    }
    if (content.length > COMMENT_MAX_LENGTH) {
      return res.status(400).json({ message: `Yorum en fazla ${COMMENT_MAX_LENGTH} karakter olabilir.` });
    }
    if (countLinks(content) > MAX_LINK_COUNT) {
      return res.status(400).json({ message: "Yorumda en fazla 2 link kullanabilirsiniz." });
    }
    if (isDuplicateComment(req.session.user.id, normalized)) {
      return res.status(400).json({ message: "Ayni yorumu kisa surede tekrar gonderemezsiniz." });
    }
    const limited = isRateLimitedForComment(req.session.user.id, ipAddress);
    if (limited.limited) {
      const retrySec = Math.ceil((limited.retryAfterMs || COMMENT_MIN_INTERVAL_MS) / 1000);
      res.set("Retry-After", String(retrySec));
      return res.status(429).json({ message: `Cok hizli yorum gonderiyorsunuz. ${retrySec} saniye sonra tekrar deneyin.` });
    }
    await run(
      "INSERT INTO comments (post_id, user_id, comment, status, created_at) VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)",
      [postId, req.session.user.id, content]
    );
    recordCommentAttempt(req.session.user.id, ipAddress);
    recordCommentContent(req.session.user.id, normalized);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Yorum eklenemedi." });
  }
});

app.patch("/api/comments/:id", requireOnlyUser, async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const { comment } = req.body;
    const content = String(comment || "").trim();
    const normalized = normalizeComment(content);
    if (!content) {
      return res.status(400).json({ message: "Yorum bos olamaz." });
    }
    if (content.length > COMMENT_MAX_LENGTH) {
      return res.status(400).json({ message: `Yorum en fazla ${COMMENT_MAX_LENGTH} karakter olabilir.` });
    }
    if (countLinks(content) > MAX_LINK_COUNT) {
      return res.status(400).json({ message: "Yorumda en fazla 2 link kullanabilirsiniz." });
    }
    const row = await get("SELECT id FROM comments WHERE id = ? AND user_id = ?", [
      commentId,
      req.session.user.id,
    ]);
    if (!row) return res.status(403).json({ message: "Bu yorumu duzenleme yetkiniz yok." });
    if (isDuplicateComment(req.session.user.id, normalized)) {
      return res.status(400).json({ message: "Ayni yorumu kisa surede tekrar gonderemezsiniz." });
    }
    await run("UPDATE comments SET comment = ? WHERE id = ?", [content, commentId]);
    recordCommentContent(req.session.user.id, normalized);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Yorum guncellenemedi." });
  }
});

app.delete("/api/comments/:id", requireOnlyUser, async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const row = await get("SELECT id FROM comments WHERE id = ? AND user_id = ?", [
      commentId,
      req.session.user.id,
    ]);
    if (!row) return res.status(403).json({ message: "Bu yorumu silme yetkiniz yok." });
    await run("DELETE FROM comments WHERE id = ?", [commentId]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Yorum silinemedi." });
  }
});

app.get("/api/admin/comments", requireAdmin, async (req, res) => {
  try {
    const requestedStatus = String(req.query.status || "pending");
    const requestedQuery = String(req.query.q || "").trim().toLowerCase();
    const rawPage = Number(req.query.page || 1);
    const rawLimit = Number(req.query.limit || 8);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 50) : 8;
    const allowed = ["pending", "approved", "rejected", "all"];
    const status = allowed.includes(requestedStatus) ? requestedStatus : "pending";
    const clauses = [];
    const params = [];

    if (status !== "all") {
      clauses.push("c.status = ?");
      params.push(status);
    }

    if (requestedQuery) {
      clauses.push("(LOWER(c.comment) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(p.title) LIKE ?)");
      const term = `%${requestedQuery}%`;
      params.push(term, term, term);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const countRow = await get(
      `SELECT COUNT(*) AS total_count
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN posts p ON p.id = c.post_id
       ${whereClause}`,
      params
    );
    const total = Number(countRow?.total_count || countRow?.count || 0);
    const offset = (page - 1) * limit;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const comments = await all(
      `SELECT c.id, c.comment, c.status, c.created_at, u.username, p.id AS post_id, p.title AS post_title
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN posts p ON p.id = c.post_id
       ${whereClause}
       ORDER BY c.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return res.json({ items: comments, page, limit, total, totalPages });
  } catch (error) {
    return res.status(500).json({ message: "Yorumlar alinamadi." });
  }
});

app.patch("/api/admin/comments/:id", requireAdmin, async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const { status } = req.body;
    if (!["approved", "rejected"].includes(String(status))) {
      return res.status(400).json({ message: "Gecersiz moderasyon durumu." });
    }
    await run("UPDATE comments SET status = ? WHERE id = ?", [status, commentId]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Yorum moderasyon islemi basarisiz." });
  }
});

app.patch("/api/admin/comments/bulk", requireAdmin, async (req, res) => {
  try {
    const { ids, status } = req.body;
    const normalizedStatus = String(status || "");
    if (!["approved", "rejected"].includes(normalizedStatus)) {
      return res.status(400).json({ message: "Gecersiz toplu moderasyon durumu." });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Toplu islem icin yorum secilmedi." });
    }
    const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
    if (uniqueIds.length === 0) {
      return res.status(400).json({ message: "Gecersiz yorum secimi." });
    }
    const placeholders = uniqueIds.map(() => "?").join(", ");
    await run(`UPDATE comments SET status = ? WHERE id IN (${placeholders})`, [normalizedStatus, ...uniqueIds]);
    return res.json({ ok: true, affected: uniqueIds.length });
  } catch (error) {
    return res.status(500).json({ message: "Toplu moderasyon islemi basarisiz." });
  }
});

app.get("/api/admin/posts", requireAdmin, async (_req, res) => {
  try {
    const posts = await all(
      "SELECT id, title, category, content, image_url, published, created_at, updated_at FROM posts ORDER BY id DESC"
    );
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Veriler alinamadi." });
  }
});

app.post("/api/admin/posts", requireAdmin, async (req, res) => {
  try {
    const { title, category, content, image_url, published } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ message: "Tum alanlar zorunludur." });
    }

    await run(
      `INSERT INTO posts (title, category, content, image_url, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [title.trim(), category.trim(), content.trim(), normalizeImageUrl(image_url), published ? 1 : 0]
    );
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Kayit sirasinda hata olustu." });
  }
});

app.put("/api/admin/posts/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, category, content, image_url, published } = req.body;
    if (!id || !title || !category || !content) {
      return res.status(400).json({ message: "Tum alanlar zorunludur." });
    }
    await run(
      "UPDATE posts SET title = ?, category = ?, content = ?, image_url = ?, published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [
        String(title).trim(),
        String(category).trim(),
        String(content).trim(),
        normalizeImageUrl(image_url),
        published ? 1 : 0,
        id,
      ]
    );
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Yazi guncellenemedi." });
  }
});

app.post("/api/admin/uploads", requireAdmin, uploadLimiter, (req, res) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      if (String(error.message || "").includes("File too large")) {
        return res.status(400).json({ message: "Dosya boyutu en fazla 5MB olabilir." });
      }
      return res.status(400).json({ message: error.message || "Dosya yuklenemedi." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Yuklenecek gorsel secilmedi." });
    }
    return res.json({ ok: true, imageUrl: `/uploads/${req.file.filename}` });
  });
});

app.patch("/api/admin/posts/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { published } = req.body;
    await run("UPDATE posts SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      published ? 1 : 0,
      id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Guncelleme yapilamadi." });
  }
});

app.get("/api/admin/site-settings", requireAdmin, async (_req, res) => {
  try {
    const rows = await all("SELECT key, value FROM site_settings ORDER BY key ASC");
    const settings = {};
    for (const row of rows) {
      if (allowedSiteSettingKeys.has(String(row.key))) settings[row.key] = row.value;
    }
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: "Site ayarlari alinamadi." });
  }
});

app.put("/api/admin/site-settings", requireAdmin, async (req, res) => {
  try {
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    for (const [key, rawValue] of Object.entries(payload)) {
      if (!allowedSiteSettingKeys.has(String(key))) continue;
      const value = String(rawValue || "").trim();
      const existing = await get("SELECT key FROM site_settings WHERE key = ?", [key]);
      if (existing) {
        await run("UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?", [value, key]);
      } else {
        await run("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", [key, value]);
      }
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Site ayarlari kaydedilemedi." });
  }
});

app.delete("/api/admin/posts/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run("DELETE FROM posts WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Silme islemi basarisiz." });
  }
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("DB init error:", err);
    process.exit(1);
  });
