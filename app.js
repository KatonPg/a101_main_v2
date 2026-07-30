(() => {
  const hero = document.querySelector("#hero");
  const status = document.querySelector("#animation-status");
  const skipButton = document.querySelector('[data-action="skip"]');
  const skipCursor = document.querySelector(".skip-cursor");
  const heroVideo = document.querySelector(".video-poster__media");
  const replayButton = document.querySelector('[data-action="replay"]');
  const heroLogo = document.querySelector(".hero-logo");
  const finalImage = document.querySelector(".final-scene__image");
  const finalCloudUpper = document.querySelector(".final-cloud--upper");
  const finalCloudLower = document.querySelector(".final-cloud--lower");
  const newsWidget = document.querySelector("[data-news-widget]");
  const newsOpenButtons = Array.from(document.querySelectorAll("[data-news-open]"));
  const newsPanel = document.querySelector("#news-panel");
  const newsCloseButton = document.querySelector("[data-news-close]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const timeline = {
    revealDelay: 1,
    revealDuration: 600,
    holdDuration: 260,
    morphDuration: 1600,
    finalDuration: 900,
  };

  let timers = [];
  let transitionLocked = false;
  let followerFrame = 0;
  let followerReady = false;
  let followerX = 0;
  let followerY = 0;
  let followerVelocityX = 0;
  let followerVelocityY = 0;
  let followerLastTime = 0;
  let targetX = 0;
  let targetY = 0;
  let pointerInsideHero = false;
  let lastPointerClientX = null;
  let lastPointerClientY = null;
  const hoverEnterDistance = 3;
  const hoverExitDistance = 14;
  const followerSafeRadius = 86;
  const parallaxLimitX = 18;
  const parallaxLimitY = 12;
  let parallaxFrame = 0;
  let parallaxLastTime = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let parallaxVelocityX = 0;
  let parallaxVelocityY = 0;
  let parallaxTargetX = 0;
  let parallaxTargetY = 0;
  let newsPanelOpen = false;
  let lastNewsTrigger = newsOpenButtons[0] || null;
  let layoutScale = 1;

  const syncLayoutMetrics = () => {
    const supportedViewportWidth = Math.max(window.innerWidth, 1280);
    layoutScale = Math.min(1, Math.max(0.8, supportedViewportWidth / 1600));

    const effectiveViewportHeight = window.innerHeight / layoutScale;
    const heroHeight = Math.min(
      900,
      Math.max(690, effectiveViewportHeight - 90),
    );

    document.documentElement.style.setProperty("--layout-scale", layoutScale.toFixed(5));
    document.documentElement.style.setProperty("--hero-height", `${heroHeight.toFixed(2)}px`);
  };

  const applyParallaxPosition = () => {
    finalImage.style.setProperty("--parallax-x", `${parallaxX.toFixed(3)}px`);
    finalImage.style.setProperty("--parallax-y", `${parallaxY.toFixed(3)}px`);
    finalCloudUpper.style.setProperty(
      "--cloud-parallax-x",
      `${(parallaxX * 1.35).toFixed(3)}px`,
    );
    finalCloudUpper.style.setProperty(
      "--cloud-parallax-y",
      `${(parallaxY * 1.2).toFixed(3)}px`,
    );
    finalCloudLower.style.setProperty(
      "--cloud-parallax-x",
      `${(parallaxX * 2.15).toFixed(3)}px`,
    );
    finalCloudLower.style.setProperty(
      "--cloud-parallax-y",
      `${(parallaxY * 1.8).toFixed(3)}px`,
    );
  };

  const renderParallax = (time) => {
    const frameRatio = parallaxLastTime
      ? Math.min((time - parallaxLastTime) / (1000 / 60), 2)
      : 1;
    parallaxLastTime = time;

    const spring = 0.04 * frameRatio;
    const damping = Math.pow(0.84, frameRatio);
    parallaxVelocityX = (parallaxVelocityX + (parallaxTargetX - parallaxX) * spring) * damping;
    parallaxVelocityY = (parallaxVelocityY + (parallaxTargetY - parallaxY) * spring) * damping;
    parallaxX += parallaxVelocityX * frameRatio;
    parallaxY += parallaxVelocityY * frameRatio;
    applyParallaxPosition();

    const remainingMotion =
      Math.abs(parallaxTargetX - parallaxX) +
      Math.abs(parallaxTargetY - parallaxY) +
      Math.abs(parallaxVelocityX) +
      Math.abs(parallaxVelocityY);

    if (remainingMotion > 0.025 && hero.dataset.stage === "final") {
      parallaxFrame = window.requestAnimationFrame(renderParallax);
      return;
    }

    parallaxX = parallaxTargetX;
    parallaxY = parallaxTargetY;
    parallaxVelocityX = 0;
    parallaxVelocityY = 0;
    parallaxLastTime = 0;
    applyParallaxPosition();
    parallaxFrame = 0;
  };

  const startParallax = () => {
    if (
      parallaxFrame ||
      reduceMotion.matches ||
      transitionLocked ||
      hero.dataset.stage !== "final"
    ) {
      return;
    }
    parallaxFrame = window.requestAnimationFrame(renderParallax);
  };

  const setParallaxTarget = (clientX, clientY) => {
    const heroRect = hero.getBoundingClientRect();
    const normalizedX = Math.min(Math.max((clientX - heroRect.left) / heroRect.width, 0), 1) * 2 - 1;
    const normalizedY = Math.min(Math.max((clientY - heroRect.top) / heroRect.height, 0), 1) * 2 - 1;

    // Инверсионное движение: фон мягко уходит в сторону, противоположную курсору.
    parallaxTargetX = -normalizedX * parallaxLimitX;
    parallaxTargetY = -normalizedY * parallaxLimitY;
    startParallax();
  };

  const returnParallaxToCenter = (immediate = false) => {
    parallaxTargetX = 0;
    parallaxTargetY = 0;

    if (immediate || reduceMotion.matches) {
      if (parallaxFrame) window.cancelAnimationFrame(parallaxFrame);
      parallaxFrame = 0;
      parallaxLastTime = 0;
      parallaxX = 0;
      parallaxY = 0;
      parallaxVelocityX = 0;
      parallaxVelocityY = 0;
      applyParallaxPosition();
      return;
    }

    startParallax();
  };

  const syncParallaxWithPointer = () => {
    if (
      pointerInsideHero &&
      lastPointerClientX !== null &&
      lastPointerClientY !== null &&
      hero.dataset.stage === "final"
    ) {
      setParallaxTarget(lastPointerClientX, lastPointerClientY);
      return;
    }
    returnParallaxToCenter();
  };

  const resetFollowerShape = () => {
    skipButton.style.setProperty("--follow-angle", "0rad");
    skipButton.style.setProperty("--follow-angle-inverse", "0rad");
    skipButton.style.setProperty("--follow-scale-x", "1");
    skipButton.style.setProperty("--follow-scale-y", "1");
  };

  const resetFollowerPhysics = () => {
    followerVelocityX = 0;
    followerVelocityY = 0;
    followerLastTime = 0;
    resetFollowerShape();
  };

  const applyFollowerShape = () => {
    const speed = Math.hypot(followerVelocityX, followerVelocityY);
    const stretch = Math.min(speed / 18, 1) * 0.055;

    if (speed < 0.02) {
      resetFollowerShape();
      return;
    }

    const angle = Math.atan2(followerVelocityY, followerVelocityX);
    skipButton.style.setProperty("--follow-angle", `${angle.toFixed(4)}rad`);
    skipButton.style.setProperty("--follow-angle-inverse", `${(-angle).toFixed(4)}rad`);
    skipButton.style.setProperty("--follow-scale-x", (1 + stretch).toFixed(4));
    skipButton.style.setProperty("--follow-scale-y", (1 - stretch * 0.45).toFixed(4));
  };

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    timers.push(timer);
    return timer;
  };

  const clearTimeline = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
  };

  const setNewsPanelOpen = (open, { focusClose = false, returnFocus = false } = {}) => {
    newsPanelOpen = open;
    newsWidget.classList.toggle("is-open", open);
    newsPanel.setAttribute("aria-hidden", String(!open));
    newsOpenButtons.forEach((button) => {
      button.setAttribute("aria-expanded", String(open));
    });

    if (open) {
      returnParallaxToCenter();
      status.textContent = "Открыта панель акций и новостей";
      if (focusClose) {
        window.requestAnimationFrame(() => {
          newsCloseButton.focus({ preventScroll: true });
        });
      }
      return;
    }

    status.textContent = "Панель акций и новостей закрыта";
    if (returnFocus && lastNewsTrigger) {
      lastNewsTrigger.focus({ preventScroll: true });
    }
  };

  const setStage = (stage, message = "") => {
    hero.dataset.stage = stage;
    skipButton.tabIndex = stage === "video" ? 0 : -1;
    if (stage === "morph" || stage === "video") {
      const playPromise = heroVideo.play();
      if (playPromise) playPromise.catch(() => {});
    } else if (stage === "start") {
      heroVideo.pause();
      heroVideo.currentTime = 0;
    } else if (stage === "final") {
      heroVideo.pause();
    }
    if (stage !== "final" && newsPanelOpen) setNewsPanelOpen(false);
    if (stage !== "final") returnParallaxToCenter(true);
    if (stage === "video") {
      if (pointerInsideHero && lastPointerClientX !== null && lastPointerClientY !== null) {
        window.requestAnimationFrame(() => {
          if (hero.dataset.stage === "video" && pointerInsideHero) {
            positionSkipButton(lastPointerClientX, lastPointerClientY);
          }
        });
      }
    } else {
      skipCursor.classList.remove("is-visible", "is-hovered");
      followerReady = false;
      if (followerFrame) {
        window.cancelAnimationFrame(followerFrame);
        followerFrame = 0;
      }
      resetFollowerPhysics();
    }
    if (message) status.textContent = message;
  };

  const renderFollower = (time) => {
    if (reduceMotion.matches) {
      followerX = targetX;
      followerY = targetY;
      resetFollowerPhysics();
    } else {
      const frameRatio = followerLastTime
        ? Math.min((time - followerLastTime) / (1000 / 60), 2)
        : 1;
      followerLastTime = time;

      const spring = 0.1 * frameRatio;
      const damping = Math.pow(0.6, frameRatio);
      followerVelocityX =
        (followerVelocityX + (targetX - followerX) * spring) * damping;
      followerVelocityY =
        (followerVelocityY + (targetY - followerY) * spring) * damping;
      followerX += followerVelocityX * frameRatio;
      followerY += followerVelocityY * frameRatio;

      const maxX = hero.clientWidth - followerSafeRadius;
      const maxY = hero.clientHeight - followerSafeRadius;
      const clampedX = Math.min(Math.max(followerX, followerSafeRadius), maxX);
      const clampedY = Math.min(Math.max(followerY, followerSafeRadius), maxY);
      if (clampedX !== followerX) followerVelocityX = 0;
      if (clampedY !== followerY) followerVelocityY = 0;
      followerX = clampedX;
      followerY = clampedY;
      applyFollowerShape();
    }

    skipCursor.style.transform = `translate3d(${followerX}px, ${followerY}px, 0)`;
    const distance = Math.hypot(targetX - followerX, targetY - followerY);
    const speed = Math.hypot(followerVelocityX, followerVelocityY);
    const isHovered = skipCursor.classList.contains("is-hovered");
    const canHover =
      hero.dataset.stage === "video" &&
      pointerInsideHero &&
      skipCursor.classList.contains("is-visible");

    if (!canHover || (isHovered && distance > hoverExitDistance)) {
      skipCursor.classList.remove("is-hovered");
    } else if (!isHovered && distance <= hoverEnterDistance) {
      skipCursor.classList.add("is-hovered");
    }

    if (distance + speed > 0.12 && hero.dataset.stage === "video") {
      followerFrame = window.requestAnimationFrame(renderFollower);
      return;
    }

    followerX = targetX;
    followerY = targetY;
    skipCursor.style.transform = `translate3d(${followerX}px, ${followerY}px, 0)`;
    resetFollowerPhysics();
    followerFrame = 0;
  };

  const positionSkipButton = (clientX, clientY) => {
    const heroRect = hero.getBoundingClientRect();
    const localX = (clientX - heroRect.left) / layoutScale;
    const localY = (clientY - heroRect.top) / layoutScale;
    targetX = Math.min(
      Math.max(localX, followerSafeRadius),
      hero.clientWidth - followerSafeRadius,
    );
    targetY = Math.min(
      Math.max(localY, followerSafeRadius),
      hero.clientHeight - followerSafeRadius,
    );

    if (!followerReady) {
      followerX = targetX;
      followerY = targetY;
      resetFollowerPhysics();
      followerReady = true;
    }

    const isEntering = !skipCursor.classList.contains("is-visible");
    skipCursor.classList.add("is-visible");
    if (isEntering) {
      skipCursor.classList.remove("is-hovered");
    } else if (Math.hypot(targetX - followerX, targetY - followerY) > hoverExitDistance) {
      skipCursor.classList.remove("is-hovered");
    }
    if (!followerFrame) followerFrame = window.requestAnimationFrame(renderFollower);
  };

  const trackPointer = (event) => {
    if (event.pointerType === "touch") return;

    lastPointerClientX = event.clientX;
    lastPointerClientY = event.clientY;
    const heroRect = hero.getBoundingClientRect();
    pointerInsideHero =
      lastPointerClientX >= heroRect.left &&
      lastPointerClientX <= heroRect.right &&
      lastPointerClientY >= heroRect.top &&
      lastPointerClientY <= heroRect.bottom;

    if (!pointerInsideHero) {
      skipCursor.classList.remove("is-visible", "is-hovered");
      if (hero.dataset.stage === "final") returnParallaxToCenter();
      return;
    }

    if (hero.dataset.stage === "video") {
      positionSkipButton(lastPointerClientX, lastPointerClientY);
    } else if (hero.dataset.stage === "final" && !transitionLocked && !newsPanelOpen) {
      setParallaxTarget(lastPointerClientX, lastPointerClientY);
    }
  };

  const syncMaskGeometry = () => {
    const heroRect = hero.getBoundingClientRect();
    const logoRect = heroLogo.getBoundingClientRect();
    const centerX = (logoRect.left + logoRect.width / 2 - heroRect.left) / layoutScale;
    const centerY = (logoRect.top + logoRect.height / 2 - heroRect.top) / layoutScale;
    const horizontalReach = Math.max(centerX, hero.clientWidth - centerX);
    const verticalReach = Math.max(centerY, hero.clientHeight - centerY);
    const radius = Math.hypot(horizontalReach, verticalReach) + 2;

    hero.style.setProperty("--mask-origin-x", `${centerX.toFixed(2)}px`);
    hero.style.setProperty("--mask-origin-y", `${centerY.toFixed(2)}px`);
    hero.style.setProperty("--mask-radius", `${radius.toFixed(2)}px`);
  };

  const showFinal = () => {
    if (hero.dataset.stage === "final" || transitionLocked) return;

    clearTimeline();
    transitionLocked = true;
    hero.classList.add("is-screen-transitioning");
    void hero.offsetWidth;
    setStage("final", "Показан основной баннер главной страницы");
    schedule(() => {
      hero.classList.remove("is-screen-transitioning");
      transitionLocked = false;
      syncParallaxWithPointer();
    }, timeline.finalDuration);
  };

  const runIntro = () => {
    clearTimeline();
    transitionLocked = false;
    hero.classList.remove("is-screen-transitioning");
    setStage("start");

    if (reduceMotion.matches) {
      setStage("final", "Анимация пропущена согласно настройкам уменьшения движения");
      return;
    }

    // Фиксируем стартовый кадр перед запуском таймлайна.
    void hero.offsetWidth;

    const revealAt = timeline.revealDelay;
    const morphAt = revealAt + timeline.revealDuration + timeline.holdDuration;
    const videoAt = morphAt + timeline.morphDuration;

    schedule(() => setStage("reveal"), revealAt);
    schedule(() => {
      syncMaskGeometry();
      setStage("morph");
    }, morphAt);
    schedule(
      () => setStage("video", "Показана видеосцена. Нажмите «Пропустить», чтобы продолжить"),
      videoAt,
    );
  };

  skipButton.addEventListener("click", (event) => {
    event.stopPropagation();
    showFinal();
  });

  replayButton.addEventListener("click", runIntro);

  newsOpenButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      lastNewsTrigger = event.currentTarget;
      setNewsPanelOpen(true, { focusClose: event.detail === 0 });
    });
  });

  newsCloseButton.addEventListener("click", (event) => {
    event.stopPropagation();
    setNewsPanelOpen(false, { returnFocus: true });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!newsPanelOpen || newsWidget.contains(event.target)) return;
    setNewsPanelOpen(false);
  });

  // В Figma обработчик установлен на весь видеокадр.
  hero.addEventListener("click", (event) => {
    if (hero.dataset.stage !== "video") return;
    if (event.target.closest("a, button") && event.target !== hero) return;
    showFinal();
  });

  window.addEventListener("pointermove", trackPointer, { passive: true });
  hero.addEventListener("pointerleave", () => {
    pointerInsideHero = false;
    skipCursor.classList.remove("is-visible", "is-hovered");
    returnParallaxToCenter();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && newsPanelOpen) {
      setNewsPanelOpen(false, { returnFocus: true });
      return;
    }
    if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) {
      runIntro();
    }
    if (event.key === "Escape" && hero.dataset.stage === "video") {
      showFinal();
    }
  });

  reduceMotion.addEventListener("change", runIntro);
  syncLayoutMetrics();
  window.addEventListener("resize", () => {
    syncLayoutMetrics();
    syncMaskGeometry();
    syncParallaxWithPointer();
  });
  runIntro();
})();
