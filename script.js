const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealElements.forEach((el) => revealObserver.observe(el));
} else {
  // Fallback: keep content visible on older browsers.
  revealElements.forEach((el) => el.classList.add("visible"));
}

const counters = document.querySelectorAll(".count");

const animateCounter = (counter) => {
  const target = Number(counter.getAttribute("data-target")) || 0;
  let current = 0;
  const step = Math.max(1, Math.floor(target / 40));

  const tick = () => {
    current += step;
    if (current >= target) {
      counter.textContent = String(target);
      return;
    }
    counter.textContent = String(current);
    requestAnimationFrame(tick);
  };

  tick();
};

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);

if ("IntersectionObserver" in window) {
  counters.forEach((counter) => counterObserver.observe(counter));
} else {
  counters.forEach((counter) => animateCounter(counter));
}

const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("theme");

if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

const refreshThemeButtonText = () => {
  if (!themeToggle) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  themeToggle.textContent = isDark ? "Aydinlik Mod" : "Karanlik Mod";
};

if (themeToggle) {
  refreshThemeButtonText();
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
    refreshThemeButtonText();
  });
}

const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

if (contactForm && formMessage) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    formMessage.textContent = "Mesajin basariyla gonderildi. Tesekkur ederim.";
    contactForm.reset();
  });
}

const typedText = document.getElementById("typedText");
const heroMessage =
  "Bu sitede ilgi alanlarim, hedeflerim ve haftalik planlarim yer aliyor. Asagidaki tablolar ile bilgiler daha duzenli bir sekilde sunulmustur.";

if (typedText) {
  let index = 0;
  const write = () => {
    if (index <= heroMessage.length) {
      typedText.textContent = heroMessage.slice(0, index);
      index += 1;
      setTimeout(write, 18);
    }
  };
  write();
}

const filterRow = document.getElementById("filterRow");
const postCards = document.querySelectorAll(".post-card");

if (filterRow && postCards.length > 0) {
  filterRow.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-btn");
    if (!button) return;

    const selectedFilter = button.getAttribute("data-filter");
    const buttons = filterRow.querySelectorAll(".filter-btn");
    buttons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    postCards.forEach((card) => {
      const category = card.getAttribute("data-category");
      const shouldShow = selectedFilter === "all" || category === selectedFilter;
      card.classList.toggle("hidden-card", !shouldShow);
    });
  });
}

const blogState = JSON.parse(localStorage.getItem("blogInteractions") || "{}");

postCards.forEach((card) => {
  const postId = card.getAttribute("data-post-id");
  if (!postId) return;

  const likeBtn = card.querySelector(".like-btn");
  const favBtn = card.querySelector(".fav-btn");
  const likeCountEl = card.querySelector(".like-count");

  const state = blogState[postId] || { likes: 0, favorite: false };
  if (likeCountEl) likeCountEl.textContent = String(state.likes);
  if (favBtn && state.favorite) {
    favBtn.classList.add("active");
    favBtn.textContent = "★ Favoride";
  }

  if (likeBtn && likeCountEl) {
    likeBtn.addEventListener("click", () => {
      state.likes += 1;
      likeCountEl.textContent = String(state.likes);
      blogState[postId] = state;
      localStorage.setItem("blogInteractions", JSON.stringify(blogState));
    });
  }

  if (favBtn) {
    favBtn.addEventListener("click", () => {
      state.favorite = !state.favorite;
      favBtn.classList.toggle("active", state.favorite);
      favBtn.textContent = state.favorite ? "★ Favoride" : "☆ Favori";
      blogState[postId] = state;
      localStorage.setItem("blogInteractions", JSON.stringify(blogState));
    });
  }
});

const projectFilterRow = document.getElementById("projectFilterRow");
const projectCards = document.querySelectorAll(".project-card");
const projectSearch = document.getElementById("projectSearch");
const projectSort = document.getElementById("projectSort");
const projectEmptyState = document.getElementById("projectEmptyState");
let activeProjectFilter = "all";
const projectDefaultOrder = Array.from(projectCards);

const sortProjectCards = () => {
  if (projectCards.length === 0 || !projectSort) return;
  const grid = document.querySelector(".projects-grid");
  if (!grid) return;

  const mode = projectSort.value;
  const sorted = [...projectCards];

  if (mode === "az") {
    sorted.sort((a, b) => {
      const aTitle = a.querySelector("h4")?.textContent?.trim() || "";
      const bTitle = b.querySelector("h4")?.textContent?.trim() || "";
      return aTitle.localeCompare(bTitle, "tr");
    });
  } else if (mode === "progress-desc" || mode === "progress-asc") {
    sorted.sort((a, b) => {
      const aVal = Number(a.querySelector(".progress-bar")?.getAttribute("data-progress") || "0");
      const bVal = Number(b.querySelector(".progress-bar")?.getAttribute("data-progress") || "0");
      return mode === "progress-desc" ? bVal - aVal : aVal - bVal;
    });
  } else {
    projectDefaultOrder.forEach((card) => grid.appendChild(card));
    return;
  }

  sorted.forEach((card) => grid.appendChild(card));
};

const applyProjectFiltering = () => {
  if (projectCards.length === 0) return;
  const searchText = (projectSearch?.value || "").toLowerCase().trim();
  let visibleCount = 0;

  projectCards.forEach((card) => {
    const category = card.getAttribute("data-project-category") || "";
    const text = card.textContent?.toLowerCase() || "";
    const categoryMatch = activeProjectFilter === "all" || category === activeProjectFilter;
    const searchMatch = searchText.length === 0 || text.includes(searchText);
    const shouldShow = categoryMatch && searchMatch;
    card.classList.toggle("hidden-card", !shouldShow);
    if (shouldShow) visibleCount += 1;
  });

  if (projectEmptyState) {
    projectEmptyState.classList.toggle("hidden-card", visibleCount !== 0);
  }
};

if (projectFilterRow && projectCards.length > 0) {
  projectFilterRow.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-btn");
    if (!button) return;

    const selectedFilter = button.getAttribute("data-project-filter");
    const buttons = projectFilterRow.querySelectorAll(".filter-btn");
    buttons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    activeProjectFilter = selectedFilter || "all";
    applyProjectFiltering();
  });
}

if (projectSearch && projectCards.length > 0) {
  projectSearch.addEventListener("input", applyProjectFiltering);
}

if (projectSort && projectCards.length > 0) {
  projectSort.addEventListener("change", () => {
    sortProjectCards();
    applyProjectFiltering();
  });
}

applyProjectFiltering();

// Projeler sayfasindaki "One Cikan Proje" alanini doldur.
const updateFeaturedProjectCard = () => {
  const featuredTitleEl = document.getElementById("featuredProjectTitle");
  const featuredCategoryEl = document.getElementById("featuredProjectCategory");
  const featuredMetaEl = document.getElementById("featuredProjectMeta");
  const featuredExcerptEl = document.getElementById("featuredProjectExcerpt");
  const featuredProgressEl = document.getElementById("featuredProjectProgress");
  const cards = Array.from(document.querySelectorAll(".project-card"));

  if (!featuredTitleEl || cards.length === 0) return;

  const toProgress = (card) => {
    const val = card.querySelector(".progress-bar")?.getAttribute("data-progress") || "0";
    return Number(val) || 0;
  };

  const bestCard = cards.reduce((best, card) => (toProgress(card) > toProgress(best) ? card : best), cards[0]);
  if (!bestCard) return;

  const category =
    bestCard.getAttribute("data-project-category") ||
    bestCard.querySelector(".post-tag")?.textContent?.trim() ||
    "Kategori";

  const title = bestCard.querySelector("h4")?.textContent?.trim() || "Proje";
  const status = bestCard.querySelector(".project-top strong")?.textContent?.trim() || "Durum";

  const directParagraph = Array.from(bestCard.children).find((el) => el.tagName === "P");
  const desc = directParagraph?.textContent?.trim() || "";

  const progress = toProgress(bestCard);

  featuredCategoryEl && (featuredCategoryEl.textContent = category);
  featuredTitleEl.textContent = title;
  if (featuredMetaEl) featuredMetaEl.textContent = `${status} • Tamamlanma: %${progress}`;
  if (featuredExcerptEl) featuredExcerptEl.textContent = desc.slice(0, 140) + (desc.length > 140 ? "..." : "");
  if (featuredProgressEl) {
    featuredProgressEl.setAttribute("data-progress", String(progress));
    featuredProgressEl.style.width = `${progress}%`;
  }
};

updateFeaturedProjectCard();

const progressBars = document.querySelectorAll(".progress-bar");

const progressObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const target = entry.target.getAttribute("data-progress") || "0";
        entry.target.style.width = `${target}%`;
        progressObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.4 }
);

if ("IntersectionObserver" in window) {
  progressBars.forEach((bar) => progressObserver.observe(bar));
} else {
  progressBars.forEach((bar) => {
    const target = bar.getAttribute("data-progress") || "0";
    bar.style.width = `${target}%`;
  });
}

const toTopBtn = document.createElement("button");
toTopBtn.className = "to-top-btn";
toTopBtn.type = "button";
toTopBtn.textContent = "↑";
toTopBtn.setAttribute("aria-label", "Sayfanin basina don");
document.body.appendChild(toTopBtn);

window.addEventListener("scroll", () => {
  toTopBtn.classList.toggle("visible", window.scrollY > 280);
});

toTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.body.classList.add("page-enter");
window.requestAnimationFrame(() => {
  document.body.style.transition = "opacity 0.25s ease, transform 0.25s ease";
  document.body.classList.remove("page-enter");
});

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") || raw.startsWith("./")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return "";
};

const estimateReadingTime = (text) => {
  const content = String(text || "").trim();
  if (!content) return "-";
  // Basit okuma suresi hesabı: 200 kelime/dk varsayimi.
  const words = content.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} dk`;
};

const applySiteSettingsToPage = (settings) => {
  const map = [
    ["index_intro_text", "indexIntroText"],
    ["index_sidebar_about", "indexSidebarAboutText"],
    ["index_newsletter_text", "indexNewsletterText"],
    ["about_profile_title", "aboutProfileTitle"],
    ["about_profile_text", "aboutProfileText"],
    ["projects_hero_text", "projectsHeroText"],
  ];
  map.forEach(([key, elementId]) => {
    const el = document.getElementById(elementId);
    const val = settings?.[key];
    if (el && typeof val === "string" && val.trim().length > 0) {
      el.textContent = val;
    }
  });

  const cardsJson = settings?.projects_cards_json;
  if (typeof cardsJson === "string" && cardsJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(cardsJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const tableBody = document.getElementById("projectsTableBody");
        const rows = [];
        parsed.slice(0, 3).forEach((item, index) => {
          const slot = index + 1;
          const card = document.querySelector(`.project-card[data-project-slot="${slot}"]`);
          if (!card) return;

          const category = String(item.category || card.getAttribute("data-project-category") || "genel")
            .trim()
            .toLowerCase();
          const title = String(item.title || "").trim();
          const status = String(item.status || "").trim();
          const description = String(item.description || "").trim();
          const problem = String(item.problem || "").trim();
          const solution = String(item.solution || "").trim();
          const result = String(item.result || "").trim();
          const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));

          if (category) card.setAttribute("data-project-category", category);
          const categoryEl = card.querySelector(".post-tag");
          if (categoryEl && category) categoryEl.textContent = category.charAt(0).toUpperCase() + category.slice(1);
          const statusEl = card.querySelector(".project-top strong");
          if (statusEl && status) statusEl.textContent = `Durum: ${status}`;
          const titleEl = card.querySelector("h4");
          if (titleEl && title) titleEl.textContent = title;
          const firstDescEl = card.querySelectorAll("p")[0];
          if (firstDescEl && description) firstDescEl.textContent = description;

          const caseLines = card.querySelectorAll(".project-case p");
          if (caseLines[0] && problem) caseLines[0].innerHTML = `<strong>Problem:</strong> ${escapeHtml(problem)}`;
          if (caseLines[1] && solution) caseLines[1].innerHTML = `<strong>Cozum:</strong> ${escapeHtml(solution)}`;
          if (caseLines[2] && result) caseLines[2].innerHTML = `<strong>Sonuc:</strong> ${escapeHtml(result)}`;

          const techList = Array.isArray(item.tech) ? item.tech.slice(0, 6) : [];
          const techWrap = card.querySelector(".project-tech");
          if (techWrap && techList.length > 0) {
            techWrap.innerHTML = techList.map((tech) => `<span>${escapeHtml(String(tech))}</span>`).join("");
          }

          const metricList = Array.isArray(item.metrics) ? item.metrics.slice(0, 4) : [];
          const metricWrap = card.querySelector(".metric-chips");
          if (metricWrap && metricList.length > 0) {
            metricWrap.innerHTML = metricList
              .map((metric) => `<span class="metric-chip">${escapeHtml(String(metric))}</span>`)
              .join("");
          }

          const progressBar = card.querySelector(".progress-bar");
          if (progressBar && Number.isFinite(progress)) {
            progressBar.setAttribute("data-progress", String(progress));
            progressBar.style.width = `${progress}%`;
          }

          rows.push({
            title: title || titleEl?.textContent || "-",
            category: category || "-",
            status: status || "-",
            progress,
          });
        });

        if (tableBody && rows.length > 0) {
          tableBody.innerHTML = rows
            .map(
              (row) =>
                `<tr><td>${escapeHtml(row.title)}</td><td>${escapeHtml(
                  row.category
                )}</td><td>${escapeHtml(row.status)}</td><td>%${row.progress}</td></tr>`
            )
            .join("");
        }
      }
    } catch (_error) {
      // Gecersiz JSON varsa varsayilan proje kartlari korunur.
    }
  }

  if (typeof applyProjectFiltering === "function") applyProjectFiltering();
  if (typeof sortProjectCards === "function") sortProjectCards();
  if (typeof updateFeaturedProjectCard === "function") updateFeaturedProjectCard();
};

const loadPublicSiteSettings = async () => {
  const hasTarget =
    document.getElementById("indexIntroText") ||
    document.getElementById("aboutProfileText") ||
    document.getElementById("indexSidebarAboutText");
  if (!hasTarget) return;
  try {
    const response = await fetch("/api/site-settings");
    if (!response.ok) return;
    const settings = await response.json();
    applySiteSettingsToPage(settings);
  } catch (_error) {
    // Public ayarlar opsiyonel; hata durumunda varsayilan metinler kullanilir.
  }
};

loadPublicSiteSettings();

const publicPosts = document.getElementById("publicPosts");
if (publicPosts) {
  const isMinimalFeed = publicPosts.classList.contains("minimalist-dynamic-posts");
  const loadComments = async (postId) => {
    const commentsWrap = publicPosts.querySelector(`[data-comments-for="${postId}"]`);
    if (!commentsWrap) return;
    const response = await fetch(`/api/posts/${postId}/comments`);
    const comments = await response.json();
    commentsWrap.innerHTML = (comments || [])
      .map(
        (item) => `
          <div class="timeline-item" data-comment-id="${item.id}">
            <strong>${escapeHtml(item.username)}</strong>
            ${
              item.status && item.status !== "approved"
                ? `<p class="minimalist-meta"><strong>Durum:</strong> ${
                    item.status === "pending" ? "Onay bekliyor" : "Reddedildi"
                  }</p>`
                : ""
            }
            <p class="comment-text">${escapeHtml(item.comment)}</p>
            <small>${escapeHtml(item.created_at)}</small>
            ${
              item.isOwner
                ? `
              <div class="post-actions">
                <button class="icon-btn comment-edit-btn" type="button">Duzenle</button>
                <button class="icon-btn comment-delete-btn" type="button">Sil</button>
              </div>
            `
                : ""
            }
          </div>
        `
      )
      .join("");
  };

  const loadPosts = async () => {
    const userAuth = await fetch("/api/users/me").then((r) => r.json());
    const response = await fetch("/api/posts");
    const posts = await response.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      publicPosts.innerHTML = '<p class="empty-state">Henuz panelden yayinlanan yazi yok.</p>';
      return;
    }

    // API dönüş sırası garanti olmadığından created_at'e göre sırala.
    const postsSorted = [...posts].sort((a, b) => {
      const ad = new Date(a?.created_at || 0).getTime();
      const bd = new Date(b?.created_at || 0).getTime();
      const aVal = Number.isNaN(ad) ? 0 : ad;
      const bVal = Number.isNaN(bd) ? 0 : bd;
      return bVal - aVal;
    });

    // Index sayfasındaki "One Cikan Yazi" alanını doldur.
    if (isMinimalFeed) {
      const featuredCard = document.getElementById("featuredPostCard");
      const featuredCategoryEl = document.getElementById("featuredPostCategory");
      const featuredTitleEl = document.getElementById("featuredPostTitle");
      const featuredMetaEl = document.getElementById("featuredPostMeta");
      const featuredExcerptEl = document.getElementById("featuredPostExcerpt");
      const featuredLinkEl = document.getElementById("featuredPostLink");

      const featured = postsSorted[0];
      if (featuredCard && featured && featuredTitleEl) {
        const readingTime = estimateReadingTime(featured.content);
        const content = String(featured.content || "").trim();
        const excerpt = content.slice(0, 180).trim();

        featuredCategoryEl && (featuredCategoryEl.textContent = featured.category || "Kategori");
        featuredTitleEl.textContent = featured.title || "Yazi";
        if (featuredMetaEl) {
          featuredMetaEl.textContent = `Tarih: ${featured.created_at || "-"} • Okuma: ${readingTime}`;
        }
        if (featuredExcerptEl) {
          featuredExcerptEl.textContent = excerpt.length ? `${excerpt}...` : "";
        }
        if (featuredLinkEl && featured.id) {
          featuredLinkEl.setAttribute("href", `post.html?id=${featured.id}`);
          featuredLinkEl.removeAttribute("aria-disabled");
        }
      }
    }

    publicPosts.innerHTML = postsSorted
      .map((post) => {
        const readingTime = estimateReadingTime(post.content);
        const content = String(post.content || "").trim();
        const excerptMax = 220;
        const excerpt = content.slice(0, excerptMax).trim();
        const isTruncated = content.length > excerptMax;
        const excerptText = excerpt.length ? escapeHtml(excerpt) : "";

        if (isMinimalFeed) {
          const imageUrl = normalizeImageUrl(post.image_url);
          return `
            <article class="minimalist-post-item" data-post-id="${post.id}">
              <p class="minimalist-meta">Kategori: ${escapeHtml(post.category)} • Tarih: ${escapeHtml(post.created_at)} • Okuma: ${escapeHtml(readingTime)}</p>
              <h4>${escapeHtml(post.title)}</h4>
              ${
                imageUrl
                  ? `<img class="card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(post.title || "Yazi gorseli")}" loading="lazy" decoding="async" />`
                  : ""
              }
              <p>${excerptText}${isTruncated ? "..." : ""}</p>
              <a href="post.html?id=${post.id}">Yaziya git</a>
              ${
                userAuth.loggedIn
                  ? `
                <form class="contact-form comment-form" data-post-id="${post.id}">
                  <textarea name="comment" rows="3" maxlength="500" placeholder="Yorumunu yaz..." required></textarea>
                  <button class="btn" type="submit">Yorum Ekle</button>
                  <p class="minimalist-meta">Yorumlar moderasyon sonrasi yayimlanabilir.</p>
                </form>
              `
                  : '<p class="empty-state">Yorum yazmak icin Kullanici girisi yap.</p>'
              }
              <div class="timeline" data-comments-for="${post.id}"></div>
            </article>
          `;
        }

        const imageUrl = normalizeImageUrl(post.image_url);
        return `
          <article class="project-card" data-post-id="${post.id}">
            <div class="project-top">
              <span class="post-tag">${escapeHtml(post.category)}</span>
              <strong>${escapeHtml(post.created_at)}</strong>
            </div>
            <h4>${escapeHtml(post.title)}</h4>
            ${
              imageUrl
                ? `<img class="card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(post.title || "Yazi gorseli")}" loading="lazy" decoding="async" />`
                : ""
            }
            <p>${excerptText}${isTruncated ? "..." : ""}</p>
            ${
              userAuth.loggedIn
                ? `
              <form class="contact-form comment-form" data-post-id="${post.id}">
                <textarea name="comment" rows="3" maxlength="500" placeholder="Yorumunu yaz..." required></textarea>
                <button class="btn" type="submit">Yorum Ekle</button>
                <p class="minimalist-meta">Yorumlar moderasyon sonrasi yayimlanabilir.</p>
              </form>
            `
                : '<p class="empty-state">Yorum yazmak icin Kullanici girisi yap.</p>'
            }
            <div class="timeline" data-comments-for="${post.id}"></div>
          </article>
        `;
      })
      .join("");

    await Promise.all(postsSorted.map((post) => loadComments(post.id)));
  };

  loadPosts().catch(() => {
    publicPosts.innerHTML = '<p class="empty-state">Yazilar yuklenemedi.</p>';
  });

  publicPosts.addEventListener("submit", async (event) => {
    const form = event.target.closest(".comment-form");
    if (!form) return;
    event.preventDefault();
    const postId = form.getAttribute("data-post-id");
    const textarea = form.querySelector("textarea[name='comment']");
    const submitBtn = form.querySelector("button[type='submit']");
    const localMessageClass = "comment-local-message";
    let localMessageEl = form.querySelector(`.${localMessageClass}`);
    if (!localMessageEl) {
      localMessageEl = document.createElement("p");
      localMessageEl.className = `minimalist-meta ${localMessageClass}`;
      form.appendChild(localMessageEl);
    }
    localMessageEl.textContent = "";
    const comment = textarea?.value?.trim();
    if (!comment) return;

    if (comment.length > 500) {
      localMessageEl.textContent = "Yorum en fazla 500 karakter olabilir.";
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      textarea.value = "";
      localMessageEl.textContent = "Yorumunuz alindi.";
      loadComments(postId);
    } else {
      localMessageEl.textContent = data.message || "Yorum gonderilemedi.";
    }
    if (submitBtn) {
      // Kisa cooldown: spam tiklamayi azaltir.
      window.setTimeout(() => {
        submitBtn.disabled = false;
      }, 2000);
    }
  });

  publicPosts.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest(".comment-delete-btn");
    const editBtn = event.target.closest(".comment-edit-btn");
    const cancelEditBtn = event.target.closest(".comment-cancel-btn");
    const saveEditBtn = event.target.closest(".comment-save-btn");
    const commentItem = event.target.closest("[data-comment-id]");
    if (!commentItem) return;

    const commentId = commentItem.getAttribute("data-comment-id");
    const postCard = event.target.closest(".project-card, .minimalist-post-item");
    const postId = postCard?.getAttribute("data-post-id");
    const textEl = commentItem.querySelector(".comment-text");

    const cleanupEditor = () => {
      const editor = commentItem.querySelector(".comment-editor");
      if (editor) editor.remove();
      textEl?.classList.remove("hidden-card");
      const currentEditBtn = commentItem.querySelector(".comment-edit-btn");
      if (currentEditBtn) currentEditBtn.disabled = false;
    };

    if (deleteBtn) {
      const response = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
      if (response.ok && postId) loadComments(postId);
      return;
    }

    if (cancelEditBtn) {
      cleanupEditor();
      return;
    }

    if (saveEditBtn) {
      const editTextarea = commentItem.querySelector(".comment-edit-input");
      const nextText = editTextarea?.value?.trim() || "";
      const oldText = textEl?.textContent?.trim() || "";
      if (!nextText) return;
      if (nextText.length > 500) return;
      if (nextText === oldText) {
        cleanupEditor();
        return;
      }
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: nextText }),
      });
      if (response.ok && postId) {
        loadComments(postId);
      } else {
        cleanupEditor();
      }
      return;
    }

    if (editBtn) {
      if (!textEl || commentItem.querySelector(".comment-editor")) return;
      const oldText = textEl.textContent || "";
      textEl.classList.add("hidden-card");
      editBtn.disabled = true;

      const editorWrap = document.createElement("div");
      editorWrap.className = "comment-editor";
      const editorInput = document.createElement("textarea");
      editorInput.className = "comment-edit-input";
      editorInput.rows = 3;
      editorInput.maxLength = 500;
      editorInput.value = oldText;

      const actionsWrap = document.createElement("div");
      actionsWrap.className = "post-actions";

      const saveButton = document.createElement("button");
      saveButton.className = "icon-btn comment-save-btn";
      saveButton.type = "button";
      saveButton.textContent = "Kaydet";

      const cancelButton = document.createElement("button");
      cancelButton.className = "icon-btn comment-cancel-btn";
      cancelButton.type = "button";
      cancelButton.textContent = "Vazgec";

      actionsWrap.append(saveButton, cancelButton);
      editorWrap.append(editorInput, actionsWrap);
      commentItem.appendChild(editorWrap);
    }
  });
}

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
if (loginForm && loginMessage) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      loginMessage.textContent = data.message || "Giris basarisiz.";
      return;
    }
    loginMessage.textContent = "Giris basarili, panele yonlendiriliyorsun...";
    window.location.href = "/admin.html";
  });
}

const postForm = document.getElementById("postForm");
const postMessage = document.getElementById("postMessage");
const savePostBtn = document.getElementById("savePostBtn");
const cancelPostEditBtn = document.getElementById("cancelPostEditBtn");
const postImageUrlInput = document.getElementById("postImageUrl");
const postImageFileInput = document.getElementById("postImageFile");
const uploadPostImageBtn = document.getElementById("uploadPostImageBtn");
const postImagePreview = document.getElementById("postImagePreview");
const adminPostsList = document.getElementById("adminPostsList");
const siteSettingsForm = document.getElementById("siteSettingsForm");
const siteSettingsMessage = document.getElementById("siteSettingsMessage");
const adminCommentsList = document.getElementById("adminCommentsList");
const adminCommentFilterRow = document.getElementById("adminCommentFilterRow");
const adminCommentSearch = document.getElementById("adminCommentSearch");
const approveAllVisibleBtn = document.getElementById("approveAllVisibleBtn");
const rejectAllVisibleBtn = document.getElementById("rejectAllVisibleBtn");
const bulkApproveVisibleBtn = document.getElementById("bulkApproveVisibleBtn");
const bulkRejectVisibleBtn = document.getElementById("bulkRejectVisibleBtn");
const adminCommentsPrevPageBtn = document.getElementById("adminCommentsPrevPageBtn");
const adminCommentsNextPageBtn = document.getElementById("adminCommentsNextPageBtn");
const adminCommentsPageInfo = document.getElementById("adminCommentsPageInfo");
const adminToast = document.getElementById("adminToast");
const logoutBtn = document.getElementById("logoutBtn");
let activeAdminCommentFilter = "pending";
let activeAdminCommentQuery = "";
let activeAdminCommentPage = 1;
const adminCommentsPageLimit = 8;
let adminCommentsTotalPages = 1;
let adminToastTimer;
let adminCommentSearchTimer;
let editingPostId = null;
let adminPostCache = [];

const showAdminToast = (message) => {
  if (!adminToast) return;
  adminToast.textContent = message;
  adminToast.classList.add("visible");
  if (adminToastTimer) window.clearTimeout(adminToastTimer);
  adminToastTimer = window.setTimeout(() => {
    adminToast.classList.remove("visible");
  }, 2600);
};

const resetPostFormMode = () => {
  editingPostId = null;
  if (savePostBtn) savePostBtn.textContent = "Yaziyi Kaydet";
  if (cancelPostEditBtn) cancelPostEditBtn.classList.add("hidden-card");
};

const refreshPostImagePreview = () => {
  if (!postImagePreview) return;
  const imageUrl = normalizeImageUrl(postImageUrlInput?.value || "");
  if (!imageUrl) {
    postImagePreview.classList.add("hidden-card");
    postImagePreview.removeAttribute("src");
    return;
  }
  postImagePreview.setAttribute("src", imageUrl);
  postImagePreview.classList.remove("hidden-card");
};

const loadAdminSiteSettings = async () => {
  if (!siteSettingsForm) return;
  try {
    const response = await fetch("/api/admin/site-settings");
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const settings = await response.json();
    Object.entries(settings || {}).forEach(([key, value]) => {
      const field = siteSettingsForm.querySelector(`[name="${key}"]`);
      if (field) field.value = value || "";
    });
  } catch (_error) {
    if (siteSettingsMessage) siteSettingsMessage.textContent = "Site ayarlari yuklenemedi.";
  }
};

const loadAdminPosts = async () => {
  if (!adminPostsList) return;
  try {
    const response = await fetch("/api/admin/posts");
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const posts = await response.json();
    const list = Array.isArray(posts) ? posts : [];
    adminPostCache = list;

    if (list.length === 0) {
      adminPostsList.innerHTML = '<p class="empty-state">Panelde gosterilecek yazi bulunamadi.</p>';
      return;
    }

    adminPostsList.innerHTML = list
      .map(
        (post) => {
          const isPublished = post.published === true || post.published === 1 || post.published === "1";
          return `
          <article class="project-card">
            <div class="project-top">
              <span class="post-tag">${escapeHtml(post.category)}</span>
              <strong>${isPublished ? "Yayinda" : "Taslak"}</strong>
            </div>
            <h4>${escapeHtml(post.title)}</h4>
            ${
              normalizeImageUrl(post.image_url)
                ? `<img class="card-image" src="${escapeHtml(normalizeImageUrl(post.image_url))}" alt="${escapeHtml(post.title || "Yazi gorseli")}" loading="lazy" decoding="async" />`
                : ""
            }
            <p>${escapeHtml(post.content).slice(0, 180)}...</p>
            <div class="post-actions">
              <button class="icon-btn admin-edit-btn" data-id="${post.id}" type="button">Duzenle</button>
              <button class="icon-btn admin-toggle-btn" data-id="${post.id}" data-published="${isPublished ? 1 : 0}">
                ${isPublished ? "Taslak Yap" : "Yayinla"}
              </button>
              <button class="icon-btn admin-delete-btn" data-id="${post.id}">Sil</button>
            </div>
          </article>
        `;
        }
      )
      .join("");
  } catch (_error) {
    adminPostsList.innerHTML = '<p class="empty-state">Panel verileri yuklenemedi. Sayfayi yenile.</p>';
  }
};

const loadAdminComments = async () => {
  if (!adminCommentsList) return;
  try {
    const response = await fetch(
      `/api/admin/comments?status=${encodeURIComponent(activeAdminCommentFilter)}&q=${encodeURIComponent(
        activeAdminCommentQuery
      )}&page=${activeAdminCommentPage}&limit=${adminCommentsPageLimit}`
    );
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const payload = await response.json();
    const list = Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : [];
    adminCommentsTotalPages = Number(payload?.totalPages || 1);

    if (activeAdminCommentPage > adminCommentsTotalPages) {
      activeAdminCommentPage = adminCommentsTotalPages;
      loadAdminComments();
      return;
    }

    if (adminCommentsPageInfo) {
      adminCommentsPageInfo.textContent = `Sayfa ${activeAdminCommentPage} / ${adminCommentsTotalPages}`;
    }
    if (adminCommentsPrevPageBtn) adminCommentsPrevPageBtn.disabled = activeAdminCommentPage <= 1;
    if (adminCommentsNextPageBtn) adminCommentsNextPageBtn.disabled = activeAdminCommentPage >= adminCommentsTotalPages;

    if (list.length === 0) {
      adminCommentsList.innerHTML = '<p class="empty-state">Secilen filtre/aramada yorum bulunmuyor.</p>';
      return;
    }

    adminCommentsList.innerHTML = list
      .map(
        (item) => `
        <article class="project-card">
          <div class="project-top">
            <span class="post-tag">Yorum</span>
            <strong>${escapeHtml(item.created_at)}</strong>
          </div>
          <h4>${escapeHtml(item.post_title)}</h4>
          <p class="minimalist-meta"><strong>Kullanici:</strong> ${escapeHtml(item.username)}</p>
          <p class="minimalist-meta"><strong>Durum:</strong> ${escapeHtml(item.status)}</p>
          <p>${escapeHtml(item.comment)}</p>
          <div class="post-actions">
            <input type="checkbox" class="admin-comment-check" data-id="${item.id}" aria-label="Yorumu sec" />
            <button class="icon-btn admin-comment-approve-btn" data-id="${item.id}" type="button">Onayla</button>
            <button class="icon-btn admin-comment-reject-btn" data-id="${item.id}" type="button">Reddet</button>
          </div>
        </article>
      `
      )
      .join("");
  } catch (_error) {
    adminCommentsList.innerHTML = '<p class="empty-state">Yorumlar yuklenemedi.</p>';
  }
};

if (postForm && postMessage) {
  fetch("/api/auth/me")
    .then((r) => r.json())
    .then((auth) => {
      if (!auth.loggedIn) window.location.href = "/login.html";
    });

  const uploadSelectedImage = async () => {
    const file = postImageFileInput?.files?.[0];
    if (!file) {
      postMessage.textContent = "Lutfen once bir gorsel dosyasi sec.";
      return;
    }
    const formData = new FormData();
    formData.append("image", file);
    if (uploadPostImageBtn) uploadPostImageBtn.disabled = true;
    const response = await fetch("/api/admin/uploads", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      postMessage.textContent = data.message || "Gorsel yuklenemedi.";
      if (uploadPostImageBtn) uploadPostImageBtn.disabled = false;
      return;
    }
    if (postImageUrlInput) postImageUrlInput.value = data.imageUrl || "";
    refreshPostImagePreview();
    postMessage.textContent = "Gorsel yuklendi. Yazi kaydetme asamasina gecebilirsin.";
    showAdminToast("Gorsel yukleme tamamlandi.");
    if (uploadPostImageBtn) uploadPostImageBtn.disabled = false;
  };

  uploadPostImageBtn?.addEventListener("click", () => {
    uploadSelectedImage();
  });

  postImageFileInput?.addEventListener("change", () => {
    const file = postImageFileInput.files?.[0];
    if (file) postMessage.textContent = `Secilen dosya: ${file.name}`;
  });

  postImageUrlInput?.addEventListener("input", () => {
    refreshPostImagePreview();
  });

  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      title: document.getElementById("postTitle")?.value,
      category: document.getElementById("postCategory")?.value,
      content: document.getElementById("postContent")?.value,
      image_url: postImageUrlInput?.value,
      published: document.getElementById("postPublished")?.checked,
    };
    const endpoint = editingPostId ? `/api/admin/posts/${editingPostId}` : "/api/admin/posts";
    const method = editingPostId ? "PUT" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      postMessage.textContent = data.message || "Kayit basarisiz.";
      return;
    }
    postMessage.textContent = editingPostId
      ? "Yazi basariyla guncellendi."
      : "Yazi basariyla kaydedildi.";
    postForm.reset();
    resetPostFormMode();
    refreshPostImagePreview();
    loadAdminPosts();
  });

  cancelPostEditBtn?.addEventListener("click", () => {
    postForm.reset();
    resetPostFormMode();
    refreshPostImagePreview();
    postMessage.textContent = "Duzenleme modu kapatildi.";
  });

  adminPostsList?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".admin-edit-btn");
    const toggleBtn = event.target.closest(".admin-toggle-btn");
    const deleteBtn = event.target.closest(".admin-delete-btn");

    if (editBtn) {
      const id = Number(editBtn.getAttribute("data-id"));
      const post = adminPostCache.find((item) => Number(item.id) === id);
      if (!post) return;
      editingPostId = id;
      document.getElementById("postTitle").value = post.title || "";
      document.getElementById("postCategory").value = post.category || "";
      document.getElementById("postContent").value = post.content || "";
      if (postImageUrlInput) postImageUrlInput.value = post.image_url || "";
      refreshPostImagePreview();
      document.getElementById("postPublished").checked =
        post.published === true || post.published === 1 || post.published === "1";
      if (savePostBtn) savePostBtn.textContent = "Degisiklikleri Kaydet";
      if (cancelPostEditBtn) cancelPostEditBtn.classList.remove("hidden-card");
      postMessage.textContent = `Yazi duzenleniyor (#${id}).`;
      postForm?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (toggleBtn) {
      const id = toggleBtn.getAttribute("data-id");
      const publishedAttr = toggleBtn.getAttribute("data-published");
      const published = publishedAttr === "1" || publishedAttr === "true";
      await fetch(`/api/admin/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      loadAdminPosts();
      return;
    }

    if (deleteBtn) {
      const id = deleteBtn.getAttribute("data-id");
      await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
      if (editingPostId && Number(editingPostId) === Number(id)) {
        postForm.reset();
        resetPostFormMode();
      }
      loadAdminPosts();
    }
  });

  adminCommentsList?.addEventListener("click", async (event) => {
    const approveBtn = event.target.closest(".admin-comment-approve-btn");
    const rejectBtn = event.target.closest(".admin-comment-reject-btn");
    if (!approveBtn && !rejectBtn) return;

    const id = (approveBtn || rejectBtn)?.getAttribute("data-id");
    const status = approveBtn ? "approved" : "rejected";
    await fetch(`/api/admin/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadAdminComments();
    showAdminToast(status === "approved" ? "Yorum onaylandi." : "Yorum reddedildi.");
  });

  adminCommentFilterRow?.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-btn");
    if (!button) return;
    const nextFilter = button.getAttribute("data-comment-filter");
    if (!nextFilter) return;
    activeAdminCommentFilter = nextFilter;
    activeAdminCommentPage = 1;
    adminCommentFilterRow.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    loadAdminComments();
  });

  adminCommentSearch?.addEventListener("input", () => {
    const query = (adminCommentSearch.value || "").trim();
    activeAdminCommentQuery = query;
    activeAdminCommentPage = 1;
    if (adminCommentSearchTimer) window.clearTimeout(adminCommentSearchTimer);
    adminCommentSearchTimer = window.setTimeout(() => {
      loadAdminComments();
    }, 220);
  });

  adminCommentsPrevPageBtn?.addEventListener("click", () => {
    if (activeAdminCommentPage <= 1) return;
    activeAdminCommentPage -= 1;
    loadAdminComments();
  });

  adminCommentsNextPageBtn?.addEventListener("click", () => {
    if (activeAdminCommentPage >= adminCommentsTotalPages) return;
    activeAdminCommentPage += 1;
    loadAdminComments();
  });

  const runBulkModeration = async (status) => {
    if (!adminCommentsList) return;
    const checked = Array.from(
      adminCommentsList.querySelectorAll(".admin-comment-check:checked")
    ).map((input) => Number(input.getAttribute("data-id")));
    const targetIds = checked.length
      ? checked
      : Array.from(adminCommentsList.querySelectorAll(".admin-comment-check")).map((input) =>
          Number(input.getAttribute("data-id"))
        );
    if (targetIds.length === 0) {
      showAdminToast("Islem yapilacak yorum bulunmuyor.");
      return;
    }
    await fetch("/api/admin/comments/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: targetIds, status }),
    });
    loadAdminComments();
    showAdminToast(
      status === "approved"
        ? `${targetIds.length} yorum onaylandi.`
        : `${targetIds.length} yorum reddedildi.`
    );
  };

  approveAllVisibleBtn?.addEventListener("click", () => runBulkModeration("approved"));
  rejectAllVisibleBtn?.addEventListener("click", () => runBulkModeration("rejected"));
  bulkApproveVisibleBtn?.addEventListener("click", () => runBulkModeration("approved"));
  bulkRejectVisibleBtn?.addEventListener("click", () => runBulkModeration("rejected"));

  siteSettingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(siteSettingsForm).entries());
    if (typeof payload.projects_cards_json === "string" && payload.projects_cards_json.trim().length > 0) {
      try {
        const parsed = JSON.parse(payload.projects_cards_json);
        if (!Array.isArray(parsed)) {
          if (siteSettingsMessage) siteSettingsMessage.textContent = "Proje kartlari JSON alani dizi formatinda olmali.";
          return;
        }
      } catch (_error) {
        if (siteSettingsMessage) siteSettingsMessage.textContent = "Proje kartlari JSON gecersiz.";
        return;
      }
    }
    const response = await fetch("/api/admin/site-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (siteSettingsMessage) siteSettingsMessage.textContent = data.message || "Ayarlar kaydedilemedi.";
      return;
    }
    if (siteSettingsMessage) siteSettingsMessage.textContent = "Site ayarlari kaydedildi.";
    showAdminToast("Site icerik ayarlari guncellendi.");
  });

  logoutBtn?.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login.html";
  });

  loadAdminPosts();
  loadAdminComments();
  loadAdminSiteSettings();
}

const userRegisterForm = document.getElementById("userRegisterForm");
const userLoginForm = document.getElementById("userLoginForm");
const changePasswordForm = document.getElementById("changePasswordForm");
const openForgotFlow = document.getElementById("openForgotFlow");
const backToAuth = document.getElementById("backToAuth");
const forgotFlowPanels = document.getElementById("forgotFlowPanels");
const verifyEmailForm = document.getElementById("verifyEmailForm");
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const registerMessage = document.getElementById("registerMessage");
const userLoginMessage = document.getElementById("userLoginMessage");
const changePasswordMessage = document.getElementById("changePasswordMessage");
const verifyMessage = document.getElementById("verifyMessage");
const forgotMessage = document.getElementById("forgotMessage");
const resetMessage = document.getElementById("resetMessage");
const userLogoutBtn = document.getElementById("userLogoutBtn");

if (openForgotFlow && backToAuth && forgotFlowPanels) {
  openForgotFlow.addEventListener("click", () => {
    forgotFlowPanels.classList.remove("hidden-card");
    openForgotFlow.classList.add("hidden-card");
    backToAuth.classList.remove("hidden-card");
    forgotFlowPanels.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  backToAuth.addEventListener("click", () => {
    forgotFlowPanels.classList.add("hidden-card");
    backToAuth.classList.add("hidden-card");
    openForgotFlow.classList.remove("hidden-card");
  });
}

if (userRegisterForm && registerMessage) {
  userRegisterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(userRegisterForm).entries());
    const response = await fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.ok) {
      registerMessage.textContent = data.verifyTokenPreview
        ? `Kayit basarili. Dogrulama tokenin: ${data.verifyTokenPreview}`
        : "Kayit basarili. E-posta dogrulama adimini tamamlayin.";
    } else {
      registerMessage.textContent = data.message;
    }
    if (response.ok) userRegisterForm.reset();
  });
}

if (userLoginForm && userLoginMessage) {
  userLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(userLoginForm).entries());
    const response = await fetch("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    userLoginMessage.textContent = response.ok ? "Giris basarili." : data.message;
    if (response.ok) userLoginForm.reset();
  });
}

if (changePasswordForm && changePasswordMessage) {
  changePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(changePasswordForm).entries());
    const response = await fetch("/api/users/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    changePasswordMessage.textContent = response.ok ? "Sifre guncellendi." : data.message;
    if (response.ok) changePasswordForm.reset();
  });
}

if (verifyEmailForm && verifyMessage) {
  verifyEmailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(verifyEmailForm).entries());
    const response = await fetch("/api/users/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    verifyMessage.textContent = data.message || (response.ok ? "E-posta dogrulandi." : "Islem basarisiz.");
    if (response.ok) verifyEmailForm.reset();
  });
}

if (forgotPasswordForm && forgotMessage) {
  forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(forgotPasswordForm).entries());
    const response = await fetch("/api/users/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    forgotMessage.textContent = data.resetTokenPreview
      ? `Sifirlama tokenin: ${data.resetTokenPreview}`
      : data.message || "Talep olusturuldu.";
    if (response.ok) forgotPasswordForm.reset();
  });
}

if (resetPasswordForm && resetMessage) {
  resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(resetPasswordForm).entries());
    const response = await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    resetMessage.textContent = data.message || (response.ok ? "Sifre yenilendi." : "Islem basarisiz.");
    if (response.ok) resetPasswordForm.reset();
  });
}

if (userLogoutBtn) {
  userLogoutBtn.addEventListener("click", async () => {
    await fetch("/api/users/logout", { method: "POST" });
    window.location.reload();
  });
}

const postTitleEl = document.getElementById("postTitle");
const postCategoryEl = document.getElementById("postCategory");
const postDateEl = document.getElementById("postDate");
const postContentEl = document.getElementById("postContent");
const postImageEl = document.getElementById("postImage");

if (postTitleEl && postCategoryEl && postContentEl) {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");

  if (!postId) {
    postTitleEl.textContent = "Yazi bulunamadi";
    postContentEl.textContent = "Gecerli bir yazi baglantisi acilmadi.";
  } else {
    fetch(`/api/posts/${postId}`)
      .then((response) => {
        if (!response.ok) throw new Error("not-found");
        return response.json();
      })
      .then(async (post) => {
        postTitleEl.textContent = post.title || "Yazi";
        postCategoryEl.textContent = post.category || "Kategori";
        if (postDateEl) postDateEl.textContent = post.created_at || "";
        postContentEl.textContent = post.content || "";
        if (postImageEl) {
          const imageUrl = normalizeImageUrl(post.image_url);
          if (imageUrl) {
            postImageEl.setAttribute("src", imageUrl);
            postImageEl.setAttribute("alt", post.title || "Yazi gorseli");
            postImageEl.classList.remove("hidden-card");
          } else {
            postImageEl.classList.add("hidden-card");
          }
        }

        const postReadingTimeEl = document.getElementById("postReadingTime");
        if (postReadingTimeEl) postReadingTimeEl.textContent = estimateReadingTime(post.content);

        const relatedPostsEl = document.getElementById("relatedPosts");
        if (relatedPostsEl) {
          try {
            const allPostsResp = await fetch("/api/posts");
            const allPosts = await allPostsResp.json();
            if (Array.isArray(allPosts) && allPosts.length > 0) {
              const currentId = post.id;
              const category = post.category;
              const sameCategory = allPosts.filter(
                (p) => p && p.id !== currentId && p.category === category
              );
              const otherCategory = allPosts.filter(
                (p) => p && p.id !== currentId && p.category !== category
              );
              const selected = [...sameCategory, ...otherCategory].slice(0, 3);

              if (selected.length === 0) {
                relatedPostsEl.innerHTML = '<p class="empty-state">Ilgili yazi bulunamadi.</p>';
              } else {
                relatedPostsEl.innerHTML = selected
                  .map((p) => {
                    const excerpt = String(p.content || "").slice(0, 120).trim();
                    return `
                      <article class="post-card">
                        <p class="post-tag">${escapeHtml(p.category)}</p>
                        <h4>${escapeHtml(p.title)}</h4>
                        <p class="minimalist-meta">${escapeHtml(p.created_at)}</p>
                        <p>${escapeHtml(excerpt)}...</p>
                        <a class="btn" href="post.html?id=${p.id}">Yaziya git</a>
                      </article>
                    `;
                  })
                  .join("");
              }
            }
          } catch (_e) {
            // Ilgili yazilar opsiyoneldir; hata olursa sessizce geceriz.
          }
        }

        document.title = `${post.title || "Yazi"} | Istatistik Guncem`;
        const desc = String(post.content || "").slice(0, 150);
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) metaDescription.setAttribute("content", desc);
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute("content", `${post.title || "Yazi"} | Istatistik Guncem`);
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) ogDescription.setAttribute("content", desc);
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
          const imageUrl = normalizeImageUrl(post.image_url);
          if (imageUrl) {
            ogImage.setAttribute("content", imageUrl);
          } else {
            const label = encodeURIComponent(post.category || "Istatistik Guncem");
            ogImage.setAttribute(
              "content",
              `https://dummyimage.com/1200x630/0f766e/ffffff&text=${label}`
            );
          }
        }
        const postSchemaEl = document.getElementById("postSchema");
        if (postSchemaEl) {
          const articleBody = String(post.content || "").slice(0, 4000);
          postSchemaEl.textContent = JSON.stringify(
            {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: post.title || "Yazi",
              datePublished: post.created_at || "",
              articleBody,
              articleSection: post.category || "",
            },
            null,
            2
          );
        }
      })
      .catch(() => {
        postTitleEl.textContent = "Yazi bulunamadi";
        postContentEl.textContent = "Bu yazi kaldirilmis olabilir veya baglanti gecersiz.";
      });
  }
}
