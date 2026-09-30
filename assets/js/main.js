/* Cổng Thông Tin Số Đoàn - Hội HUIT
   JavaScript dùng chung cho trang chủ và các trang con.
*/
(function () {
  "use strict";

  if (window.__HUIT_PORTAL_MAIN__) return;
  window.__HUIT_PORTAL_MAIN__ = true;

  const SESSION_KEYS = [
    "authVersion",
    "userName",
    "userUid",
    "userRole",
    "userEmail",
    "userPhoto",
    "userToken",
    "adminVerified",
    "adminEmail",
    "adminName"
  ];

  const NESTED_PATH =
    /\/(admin|diem-ren-luyen|faq|ho-so|van-hoa-hcm|vinh-quang|tin-tuc|dang-bai|don-vi)(?:\/|$)/i;
  let headerSession = null;
  let authReady = false;
  let authGeneration = 0;

  function isNestedPage() {
    return (
      Boolean(document.querySelector('link[href^="../assets/"]')) ||
      NESTED_PATH.test(window.location.pathname)
    );
  }

  function relativePage(file) {
    const prefix = isNestedPage() ? "../" : "";
    return new URL(prefix + file, document.baseURI).href;
  }

  function readSession() {
    // Firebase determines whether a user is signed in. Cached profile values
    // must never make a previous account appear during authentication startup.
    return headerSession;
  }

  function clearSession() {
    try {
      SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch { /* Header authentication also works when browser storage is blocked. */ }
  }

  function initials(name) {
    const words = String(name || "HUIT")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return (
      words
        .slice(-2)
        .map((word) => word.charAt(0))
        .join("") || "H"
    ).toUpperCase();
  }

  function createIcon(className) {
    const element = document.createElement("i");
    element.className = className;
    element.setAttribute("aria-hidden", "true");
    return element;
  }

  function createAvatar(session) {
    if (!session.photo) {
      const fallback = document.createElement("span");

      fallback.className =
        "global-account-avatar global-account-initials";
      fallback.textContent = initials(session.name);
      fallback.setAttribute("aria-hidden", "true");

      return fallback;
    }

    const image = document.createElement("img");

    image.className = "global-account-avatar";
    image.src = session.photo;
    image.alt = session.name || "Thành viên HUIT";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    image.addEventListener(
      "error",
      () => {
        const fallback = document.createElement("span");

        fallback.className =
          "global-account-avatar global-account-initials";
        fallback.textContent = initials(session.name);
        fallback.setAttribute("aria-hidden", "true");

        image.replaceWith(fallback);
      },
      { once: true }
    );

    return image;
  }

  function removeAccount(headerActions) {
    const account = headerActions.querySelector("[data-global-account]");

    if (!account) return;

    if (typeof account.__dispose === "function") {
      account.__dispose();
    }

    account.remove();
  }

  function createLoginLink(headerActions) {
    let link = headerActions.querySelector("a[data-auth-login]");

    if (!link) {
      link = [...headerActions.querySelectorAll("a")].find((anchor) =>
        /login\.html|Đăng nhập/i.test(
          anchor.href + anchor.textContent
        )
      );
    }

    if (!link) {
      link = document.createElement("a");

      headerActions.insertBefore(
        link,
        headerActions.querySelector(".mobile-toggle") || null
      );
    }

    link.className = "btn btn-primary";
    link.dataset.authLogin = "true";
    link.hidden = !authReady;
    link.href = relativePage("ho-so/login.html");
    link.setAttribute("aria-label", "Đăng nhập hệ thống");

    link.replaceChildren(
      createIcon("fa-solid fa-arrow-right-to-bracket"),
      document.createTextNode("Đăng nhập")
    );

    return link;
  }

  function renderLoggedOut(headerActions) {
    removeAccount(headerActions);
    createLoginLink(headerActions);
  }

  function getAccountDestination(session) {
    if (session.role === "unit") {
      return ["don-vi/", "fa-solid fa-building-columns", "Không gian đơn vị"];
    }
    if (session.role === "admin") {
      return [
        "admin/index.html",
        "fa-solid fa-gauge-high",
        "Bảng quản trị"
      ];
    }

    if (session.role === "guest") {
      return [
        "ho-so/login.html",
        "fa-solid fa-arrow-right-to-bracket",
        "Đăng nhập để nộp hồ sơ"
      ];
    }

    return [
      "ho-so/index.html",
      "fa-solid fa-id-card",
      "Hồ sơ của tôi"
    ];
  }

  function renderLoggedIn(headerActions, session) {
    headerActions.querySelectorAll('a[data-auth-login], a[href*="login.html"]').forEach(link => link.remove());

    removeAccount(headerActions);

    const account = document.createElement("div");
    account.className = "global-account";
    account.dataset.globalAccount = "true";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "global-account-trigger";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", `Tài khoản ${session.name}`);

    trigger.appendChild(createAvatar(session));

    const copy = document.createElement("span");
    copy.className = "global-account-copy";

    const name = document.createElement("strong");
    name.textContent = session.name;

    const role = document.createElement("small");

    role.textContent =
      session.role === "admin"
        ? "Quản trị viên"
        : session.role === "unit"
          ? session.unitName || "Tài khoản đơn vị"
        : session.role === "guest"
          ? "Khách tham quan"
          : "Tài khoản HUIT";

    copy.append(name, role);

    trigger.append(
      copy,
      createIcon("fa-solid fa-chevron-down global-account-chevron")
    );

    const menu = document.createElement("div");
    menu.id = "global-account-menu";
    menu.className = "global-account-menu";
    menu.setAttribute("role", "menu");
    menu.inert = true;
    trigger.setAttribute("aria-controls", menu.id);

    const [
      destination,
      destinationIcon,
      destinationText
    ] = getAccountDestination(session);

    const accountLink = document.createElement("a");
    accountLink.href = relativePage(destination);
    accountLink.setAttribute("role", "menuitem");

    accountLink.append(
      createIcon(destinationIcon),
      document.createTextNode(destinationText)
    );

    const homeLink = document.createElement("a");
    homeLink.href = relativePage("index.html");
    homeLink.setAttribute("role", "menuitem");

    homeLink.append(
      createIcon("fa-solid fa-house"),
      document.createTextNode("Về trang chủ")
    );

    const divider = document.createElement("span");
    divider.className = "global-account-divider";
    divider.setAttribute("aria-hidden", "true");

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "global-account-logout";
    logout.setAttribute("role", "menuitem");

    logout.append(
      createIcon("fa-solid fa-arrow-right-from-bracket"),
      document.createTextNode("Đăng xuất")
    );

    menu.append(accountLink);
    if (session.role === 'admin') {
      const publishLink = document.createElement('a');
      publishLink.href = relativePage('dang-bai/');
      publishLink.setAttribute('role', 'menuitem');
      publishLink.append(createIcon('fa-solid fa-pen-to-square'), document.createTextNode('Đăng bài trang chủ'));
      menu.append(publishLink);
    }
    menu.append(homeLink, divider, logout);
    account.append(trigger, menu);

    headerActions.insertBefore(
      account,
      headerActions.querySelector(".mobile-toggle") || null
    );

    const closeMenu = () => {
      account.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      menu.inert = true;
    };

    const onTrigger = (event) => {
      event.stopPropagation();

      const open = account.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(open));
      menu.inert = !open;
    };

    const onDocumentClick = (event) => {
      if (!account.contains(event.target)) {
        closeMenu();
      }
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        const wasOpen = account.classList.contains("is-open");
        closeMenu();
        if (wasOpen) trigger.focus();
      }
    };
    const onAccountKeydown = (event) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = [...menu.querySelectorAll('[role="menuitem"]')];
      if (!items.length) return;
      account.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.inert = false;
      const current = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowUp' ? (current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length)
        : (current + 1) % items.length;
      items[next].focus();
    };

    trigger.addEventListener("click", onTrigger);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeydown);
    account.addEventListener('keydown', onAccountKeydown);
    account.addEventListener('focusout', (event) => {
      if (!account.contains(event.relatedTarget)) closeMenu();
    });

    logout.addEventListener("click", async () => {
      logout.disabled = true;

      try {
        await signOutFirebase();
        headerSession = null;
        clearSession();
        closeMenu();
        syncHeader();
      } catch {
        logout.disabled = false;
        window.portalToast?.('Chưa đăng xuất được. Kiểm tra kết nối và thử lại.');
      }
    });

    account.__dispose = () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeydown);

      trigger.removeEventListener("click", onTrigger);
      account.removeEventListener('keydown', onAccountKeydown);
    };
  }

  function renderAccountSpotlight(session) {
    const spotlight = document.querySelector(
      "[data-account-spotlight]"
    );

    if (!spotlight) return;

    const title = spotlight.querySelector(
      "[data-account-title]"
    );

    const description = spotlight.querySelector(
      "[data-account-description]"
    );

    const action = spotlight.querySelector(
      "[data-account-action]"
    );

    const iconNode = spotlight.querySelector(
      "[data-account-icon]"
    );

    const status = spotlight.querySelector(
      "[data-account-status]"
    );

    spotlight.classList.toggle(
      "is-authenticated",
      Boolean(session)
    );

    spotlight.classList.toggle(
      "is-guest",
      session?.role === "guest"
    );

    if (!session) {
      if (title) {
        title.textContent = "Đăng nhập để quản lý hồ sơ";
      }

      if (description) {
        description.textContent =
          "Một tài khoản giúp nộp hồ sơ, xem thông báo và sử dụng trọn vẹn các tiện ích của cổng thông tin.";
      }

      if (action) {
        action.href = relativePage("ho-so/login.html");
        action.textContent = "Đăng nhập";
      }

      if (iconNode) {
        iconNode.innerHTML =
          '<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>';
      }

      if (status) {
        status.textContent = "Khu vực cá nhân";
      }

      return;
    }

    const isAdmin = session.role === "admin";
    const isGuest = session.role === "guest";

    if (title) {
      title.textContent = isAdmin
        ? "Bảng quản trị đã sẵn sàng"
        : isGuest
          ? "Bạn đang ở chế độ khách"
          : `Xin chào, ${session.name}`;
    }

    if (description) {
      description.textContent = isAdmin
        ? "Mở bảng quản trị để tiếp nhận, xử lý hồ sơ và gửi thông báo cho sinh viên."
        : isGuest
          ? "Đăng nhập tài khoản để nộp hồ sơ và theo dõi tiến độ cá nhân."
          : "Mở hồ sơ để nộp yêu cầu mới, xem trạng thái và nhận thông báo cập nhật.";
    }

    if (action) {
      action.href = relativePage(
        isAdmin
          ? "admin/index.html"
          : isGuest
            ? "ho-so/login.html"
            : "ho-so/index.html"
      );

      action.textContent = isAdmin
        ? "Mở quản trị"
        : isGuest
          ? "Đăng nhập tài khoản"
          : "Mở hồ sơ của tôi";
    }

    if (iconNode) {
      const iconClass = isAdmin
        ? "fa-gauge-high"
        : isGuest
          ? "fa-eye"
          : "fa-user-check";

      iconNode.innerHTML =
        `<i class="fa-solid ${iconClass}" aria-hidden="true"></i>`;
    }

    if (status) {
      status.textContent = isAdmin
        ? "Quản trị viên"
        : isGuest
          ? "Chế độ khách"
          : "Tài khoản đang hoạt động";
    }
  }

  function syncHeader() {
    const actions = document.querySelector(".header-actions");
    const session = readSession();
    document.querySelector('.site-header')?.setAttribute('data-auth-state', authReady ? 'ready' : 'pending');

    if (actions) {
      if (session) {
        renderLoggedIn(actions, session);
      } else {
        renderLoggedOut(actions);
      }
    }

    renderAccountSpotlight(session);
  }

  async function signOutFirebase() {
    try {
      if (window.__HUIT_AUTH__) {
        const { signOut } = await import(
          "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js"
        );

        await signOut(window.__HUIT_AUTH__);
        return;
      }

      const configUrl = new URL(
        (isNestedPage() ? "../" : "") +
          "assets/js/firebase-config.js",
        document.baseURI
      ).href;

      const [
        { getApps, getApp, initializeApp },
        { getAuth, signOut },
        { firebaseConfig }
      ] = await Promise.all([
        import(
          "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js"
        ),
        import(
          "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js"
        ),
        import(configUrl)
      ]);

      const app = getApps().length
        ? getApp()
        : initializeApp(firebaseConfig);

      await signOut(getAuth(app));
    } catch (error) {
      console.warn("Firebase sign out unavailable.", error);
      throw error;
    }
  }

  function setupNavigation() {
    const header =
      document.getElementById("header") ||
      document.querySelector(".site-header");

    const toggle = document.getElementById("mobileToggle");
    const nav = document.getElementById("mainNav");

    const onScroll = () => {
      header?.classList.toggle(
        "scrolled",
        window.scrollY > 24
      );
    };

    onScroll();

    window.addEventListener("scroll", onScroll, {
      passive: true
    });

    if (!toggle || !nav) return;
    document.querySelector('.header-actions')?.append(toggle);
    toggle.setAttribute("aria-label", "Mở menu điều hướng");
    toggle.setAttribute("aria-controls", nav.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.type = 'button';
    const compact = window.matchMedia('(max-width: 1279px)');

    const closeMenu = () => {
      nav.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute('aria-label', 'Mở menu điều hướng');
      document.body.classList.remove("menu-open");
      nav.inert = compact.matches;
    };

    compact.addEventListener('change', closeMenu);
    closeMenu();

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();

      const open = nav.classList.toggle("active");

      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("menu-open", open);
      nav.inert = !open && compact.matches;
      toggle.setAttribute('aria-label', open ? 'Đóng menu điều hướng' : 'Mở menu điều hướng');
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        closeMenu();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        nav.classList.contains("active") &&
        !nav.contains(event.target) &&
        !toggle.contains(event.target)
      ) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const wasOpen = nav.classList.contains('active');
        closeMenu();
        if (wasOpen) toggle.focus();
      }
    });
  }

  function setupReveal() {
    const nodes = [
      ...document.querySelectorAll("[data-reveal]")
    ];

    if (!nodes.length) return;

    document.body.classList.add("reveal-ready");

    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => {
        node.classList.add("is-visible");
      });

      return;
    }

    const observer = new IntersectionObserver(
      (entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          instance.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -30px"
      }
    );

    nodes.forEach((node) => observer.observe(node));
  }

  function setModal(modal, open) {
    if (!modal) return;

    if (open) {
      modal.__previousFocus = document.activeElement;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      const heading = modal.querySelector("h2, h3");
      if (heading) {
        heading.id ||= modal.id + "-title";
        modal.setAttribute("aria-labelledby", heading.id);
      }
    }

    modal.style.display = open ? "flex" : "none";
    modal.setAttribute("aria-hidden", String(!open));

    document.body.classList.toggle("modal-open", open);
    if (open) {
      modal.querySelector("button, [tabindex]")?.focus();
    } else if (modal.__previousFocus) {
      modal.__previousFocus.focus();
      modal.__previousFocus = null;
    }
  }

  function closeAllModals() {
    document
      .querySelectorAll("[data-modal-overlay]")
      .forEach((modal) => {
        setModal(modal, false);
      });

    const lightbox = document.getElementById(
      "image-lightbox"
    );

    if (lightbox) {
      lightbox.style.display = "none";
      lightbox.setAttribute("aria-hidden", "true");
    }

    document.body.classList.remove("modal-open");
  }

  function openLightbox(image) {
    const lightbox = document.getElementById(
      "image-lightbox"
    );

    const target = document.getElementById(
      "lightbox-img"
    );

    if (!lightbox || !target || !image) return;

    target.src = image.currentSrc || image.src;
    target.alt = image.alt || "Ảnh thành tích HUIT";

    lightbox.style.display = "flex";
    lightbox.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");
  }

  function setupHome() {
    const home = document.querySelector(
      ".news-section, .vinh-quang-page"
    );

    if (!home) return;

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const modal = document.querySelector('[data-modal-overlay][aria-hidden="false"]');
      if (!modal) return;
      const targets = [...modal.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });

    document
      .querySelectorAll("[data-modal-target]")
      .forEach((card) => {
        const open = () => {
          const modal = document.getElementById(
            card.dataset.modalTarget
          );

          setModal(modal, true);
        };

        card.addEventListener("click", open);

        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          open();
        });
      });

    document
      .querySelectorAll("[data-modal-close]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const modal = document.getElementById(
            button.dataset.modalClose
          );

          setModal(modal, false);
        });
      });

    document
      .querySelectorAll("[data-modal-overlay]")
      .forEach((modal) => {
        modal.addEventListener("click", (event) => {
          if (event.target === modal) {
            setModal(modal, false);
          }
        });
      });

    const toggle = document.getElementById(
      "toggleNewsBtn"
    );

    toggle?.addEventListener("click", () => {
      const open =
        toggle.getAttribute("aria-expanded") !== "true";

      document
        .querySelectorAll(".extra-news")
        .forEach((card) => {
          card.hidden = !open;

          if (open) {
            card.classList.add("is-visible");
          }
        });

      toggle.setAttribute(
        "aria-expanded",
        String(open)
      );

      toggle.innerHTML = open
        ? 'Thu gọn <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>'
        : 'Xem thêm tin tức <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
    });

    document
      .querySelectorAll(".image-gallery img")
      .forEach((image) => {
        image.addEventListener("click", () => {
          openLightbox(image);
        });
      });

    document
      .querySelector("[data-lightbox-close]")
      ?.addEventListener("click", closeAllModals);

    document
      .getElementById("image-lightbox")
      ?.addEventListener("click", (event) => {
        if (event.target.id === "image-lightbox") {
          closeAllModals();
        }
      });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAllModals();
      }
    });
  }

  async function observeFirebaseAuth() {
    try {
      const configUrl = new URL(
        (isNestedPage() ? "../" : "") +
          "assets/js/firebase-config.js",
        document.baseURI
      ).href;

      const [
        { getApps, getApp, initializeApp },
        { getAuth, onAuthStateChanged },
        { firebaseConfig }
      ] = await Promise.all([
        import(
          "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js"
        ),
        import(
          "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js"
        ),
        import(configUrl)
      ]);

      const app = getApps().length
        ? getApp()
        : initializeApp(firebaseConfig);

      const auth = getAuth(app);
      window.__HUIT_AUTH__ = auth;

      onAuthStateChanged(auth, async (user) => {
        const generation = ++authGeneration;
        authReady = true;
        if (!user) {
          headerSession = null;
          clearSession();
          syncHeader();

          window.dispatchEvent(
            new CustomEvent("huit:auth-changed", {
              detail: null
            })
          );

          return;
        }

        const role = user.isAnonymous ? "guest" : "student";

        const fallback =
          role === "admin"
            ? "Quản trị viên"
            : role === "guest"
              ? "Khách tham quan"
              : "Thành viên HUIT";

        headerSession = {
          uid: user.uid,
          role,
          name: user.displayName || user.email?.split("@")[0] || fallback,
          email: user.email || "",
          photo: user.photoURL || ""
        };
        try {
          localStorage.setItem("authVersion", "6");
          localStorage.setItem("userUid", user.uid);
          localStorage.setItem("userName", headerSession.name);
          localStorage.setItem("userEmail", headerSession.email);
          localStorage.setItem("userPhoto", headerSession.photo);
          localStorage.setItem("userToken", "firebase-managed");
          localStorage.setItem("userRole", role);
        } catch { /* Firebase remains the source of the active user. */ }

        syncHeader();

        window.dispatchEvent(
          new CustomEvent("huit:auth-changed", {
            detail: user
          })
        );
        if (!user.isAnonymous) {
          try {
            const { getPortalContext } = await import(new URL('unit-context.js', configUrl).href);
            const context = await getPortalContext(user);
            if (generation !== authGeneration) return;
            if (context.admin) {headerSession = {...headerSession, role:'admin'};syncHeader();return;}
            if (context.membership) {
              headerSession = { ...headerSession, role: 'unit', unitName: context.membership.name };
              syncHeader();
              return;
            }
          } catch { /* The basic account menu stays usable if context is unavailable. */ }

        }
      });
    } catch (error) {
      authReady = true;
      headerSession = null;
      syncHeader();
      console.warn(
        "Firebase header sync unavailable.",
        error
      );
    }
  }

  function init() {
    setupNavigation();
    syncHeader();
    setupReveal();
    setupHome();
    observeFirebaseAuth();

    // Firebase's observer also handles sign-in and sign-out in another tab.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();
