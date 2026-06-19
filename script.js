/* =====================================================
   ClarityAI — script.js
   100% client-side. No backend.
   Features:
   - Sticky nav + mobile menu
   - Before/After draggable slider (hero + tool)
   - FAQ accordion
   - Drag & drop / file upload
   - Settings (sharpness / contrast / denoise)
   - AI enhancement via Hugging Face Inference API
   - Local Canvas fallback (unsharp mask, contrast, denoise)
   - Toast notifications
   - localStorage for API key + history
   ===================================================== */

(() => {
  'use strict';

  /* ============ Utilities ============ */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const STORAGE_KEYS = {
    API_KEY: 'clarityai_hf_key',
  };

  /* ============ Toast Notifications ============ */
  const toastStack = $('#toastStack');
  const TOAST_ICONS = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ' };

  function showToast(message, type = 'info', duration = 4200) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type] || 'ℹ'}</span><span>${message}</span>`;
    toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 320);
    }, duration);
  }

  /* ============ Navigation ============ */
  const nav = $('#mainNav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
  }, { passive: true });

  const navToggle = $('#navToggle');
  const navMobile = $('#navMobile');
  navToggle?.addEventListener('click', () => {
    const isOpen = navMobile.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  $$('.nav-mobile a').forEach(a => a.addEventListener('click', () => {
    navMobile.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }));

  /* ============ Before/After Slider (reusable) ============ */
  function initBeforeAfterSlider(containerId, dividerId, beforeLayerId) {
    const container = $(`#${containerId}`);
    const divider = $(`#${dividerId}`);
    const beforeLayer = $(`#${beforeLayerId}`);
    if (!container || !divider || !beforeLayer) return null;

    let dragging = false;

    function setPosition(percent) {
      percent = clamp(percent, 0, 100);
      beforeLayer.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
      divider.style.left = `${percent}%`;
    }

    function positionFromEvent(clientX) {
      const rect = container.getBoundingClientRect();
      const percent = ((clientX - rect.left) / rect.width) * 100;
      setPosition(percent);
    }

    function onDown(e) {
      dragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      positionFromEvent(clientX);
    }
    function onMove(e) {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      positionFromEvent(clientX);
      e.preventDefault();
    }
    function onUp() { dragging = false; }

    container.addEventListener('mousedown', onDown);
    container.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    // Click anywhere on container also moves it
    container.addEventListener('click', (e) => positionFromEvent(e.clientX));

    setPosition(50);
    return { setPosition };
  }

  const heroSliderCtl = initBeforeAfterSlider('heroSlider', 'heroDivider', 'heroBeforeLayer');
  const toolSliderCtl = initBeforeAfterSlider('toolSlider', 'toolDivider', 'toolBeforeLayer');

  /* ============ FAQ Accordion ============ */
  $$('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const answer = $('.faq-a', item);
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close all others
      $$('.faq-q').forEach(other => {
        if (other !== btn) {
          other.setAttribute('aria-expanded', 'false');
          $('.faq-a', other.closest('.faq-item')).classList.remove('is-open');
        }
      });

      btn.setAttribute('aria-expanded', String(!isOpen));
      answer.classList.toggle('is-open', !isOpen);
    });
  });

  /* ============ API Key Panel ============ */
  const apiToggle = $('#apiToggle');
  const apiBody = $('#apiBody');
  const apiChevron = $('#apiChevron');
  const apiKeyInput = $('#apiKeyInput');
  const saveApiKeyBtn = $('#saveApiKeyBtn');
  const apiDot = $('#apiDot');
  const apiStatusText = $('#apiStatusText');

  let hfApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || '';

  function refreshApiStatus() {
    if (hfApiKey) {
      apiDot.dataset.state = 'ok';
      apiStatusText.textContent = 'IA activée — clé API configurée';
      apiKeyInput.value = hfApiKey;
    } else {
      apiDot.dataset.state = 'warn';
      apiStatusText.textContent = 'Configuration API IA (recommandé pour meilleurs résultats)';
    }
  }
  refreshApiStatus();

  apiToggle.addEventListener('click', () => {
    const isHidden = apiBody.hasAttribute('hidden');
    if (isHidden) {
      apiBody.removeAttribute('hidden');
    } else {
      apiBody.setAttribute('hidden', '');
    }
    apiToggle.setAttribute('aria-expanded', String(isHidden));
    apiChevron.classList.toggle('is-open', isHidden);
  });

  saveApiKeyBtn.addEventListener('click', () => {
    const val = apiKeyInput.value.trim();
    if (val) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, val);
      hfApiKey = val;
      showToast('Clé API sauvegardée localement.', 'success');
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
      hfApiKey = '';
      showToast('Clé API supprimée. Le mode local sera utilisé.', 'info');
    }
    refreshApiStatus();
  });

  /* ============ Settings sliders ============ */
  const sharpnessRange = $('#sharpnessRange');
  const contrastRange  = $('#contrastRange');
  const denoiseRange   = $('#denoiseRange');
  const sharpnessVal   = $('#sharpnessVal');
  const contrastVal    = $('#contrastVal');
  const denoiseVal     = $('#denoiseVal');

  function bindRangeOutput(range, output) {
    range.addEventListener('input', () => { output.textContent = range.value; });
  }
  bindRangeOutput(sharpnessRange, sharpnessVal);
  bindRangeOutput(contrastRange, contrastVal);
  bindRangeOutput(denoiseRange, denoiseVal);

  $('#resetSettingsBtn').addEventListener('click', () => {
    sharpnessRange.value = 70; sharpnessVal.textContent = '70';
    contrastRange.value  = 50; contrastVal.textContent  = '50';
    denoiseRange.value   = 30; denoiseVal.textContent   = '30';
    showToast('Réglages réinitialisés.', 'info', 2200);
  });

  /* ============ Upload / Drop zone ============ */
  const dropzone   = $('#dropzone');
  const fileInput  = $('#fileInput');
  const browseBtn  = $('#browseBtn');
  const workspace  = $('#workspace');

  const toolBeforeImg   = $('#toolBeforeImg');
  const toolAfterImg    = $('#toolAfterImg');
  const afterPlaceholder = $('#afterPlaceholder');
  const imgInfo    = $('#imgInfo');
  const infoName   = $('#infoName');
  const infoDims   = $('#infoDims');
  const infoSize   = $('#infoSize');

  const enhanceBtn  = $('#enhanceBtn');
  const downloadBtn = $('#downloadBtn');
  const newImageBtn = $('#newImageBtn');

  const statusArea  = $('#statusArea');
  const statusMsg   = $('#statusMsg');
  const progressFill = $('#progressFill');

  let currentFile = null;
  let currentImageEl = null; // loaded Image() of original
  let enhancedDataUrl = null;

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  }

  function handleFile(file) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showToast('Format non supporté. Utilisez JPG, PNG, WebP ou GIF.', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('Fichier trop volumineux (max 10 MB).', 'error');
      return;
    }

    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        currentImageEl = img;
        toolBeforeImg.src = dataUrl;
        toolAfterImg.src = '';
        enhancedDataUrl = null;
        afterPlaceholder.classList.remove('hidden');
        downloadBtn.disabled = true;

        // Reset slider to middle
        toolSliderCtl?.setPosition(50);

        // Show workspace
        workspace.removeAttribute('hidden');
        dropzone.style.display = 'none';

        // Image info
        infoName.textContent = file.name.length > 22 ? file.name.slice(0, 19) + '…' : file.name;
        infoDims.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
        infoSize.textContent = formatBytes(file.size);
        imgInfo.removeAttribute('hidden');

        // Scroll to workspace
        workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('Image importée avec succès.', 'success', 2500);
      };
      img.onerror = () => showToast('Impossible de charger cette image.', 'error');
      img.src = dataUrl;
    };
    reader.onerror = () => showToast('Erreur de lecture du fichier.', 'error');
    reader.readAsDataURL(file);
  }

  // Click / browse
  browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  dropzone.addEventListener('click', (e) => {
    if (e.target === browseBtn) return;
    fileInput.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]));

  // Drag & drop
  ['dragenter', 'dragover'].forEach(evt =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  });

  // New image button
  newImageBtn.addEventListener('click', () => {
    workspace.setAttribute('hidden', '');
    dropzone.style.display = '';
    fileInput.value = '';
    currentFile = null;
    currentImageEl = null;
    enhancedDataUrl = null;
    statusArea.setAttribute('hidden', '');
    dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ============ Status helpers ============ */
  function setStatus(visible, message = '', progress = 0) {
    if (!visible) {
      statusArea.setAttribute('hidden', '');
      return;
    }
    statusArea.removeAttribute('hidden');
    statusMsg.textContent = message;
    progressFill.style.width = `${progress}%`;
    statusArea.querySelector('.progress-bar').setAttribute('aria-valuenow', String(progress));
  }

  /* ============ Local Canvas Fallback Processing ============ */
  /**
   * Applies sharpening (3x3 convolution unsharp-mask-like kernel),
   * contrast boost, and basic noise reduction (light box blur mixed in)
   * directly via Canvas pixel manipulation.
   */
  function processImageLocally(img, settings) {
    return new Promise((resolve) => {
      const { sharpness, contrast, denoise } = settings;

      // Cap working resolution for performance
      const MAX_DIM = 1600;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_DIM || h > MAX_DIM) {
        const scale = MAX_DIM / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      let imageData = ctx.getImageData(0, 0, w, h);

      // Step 1: Light denoise (box blur) blended in proportion to `denoise`
      if (denoise > 0) {
        imageData = applyDenoise(imageData, w, h, denoise / 100);
      }

      // Step 2: Sharpen via unsharp-mask-style convolution kernel
      if (sharpness > 0) {
        imageData = applySharpen(imageData, w, h, sharpness / 100);
      }

      // Step 3: Contrast adjustment
      if (contrast !== 50) {
        imageData = applyContrast(imageData, (contrast - 50) / 50); // -1..1
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    });
  }

  function applyContrast(imageData, factor) {
    // factor: -1 (less contrast) .. +1 (more contrast)
    const data = imageData.data;
    const strength = factor * 80; // scale to a reasonable contrast delta
    const c = (259 * (strength + 255)) / (255 * (259 - strength));
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = clamp(c * (data[i]     - 128) + 128, 0, 255);
      data[i + 1] = clamp(c * (data[i + 1] - 128) + 128, 0, 255);
      data[i + 2] = clamp(c * (data[i + 2] - 128) + 128, 0, 255);
    }
    return imageData;
  }

  function applySharpen(imageData, w, h, amount) {
    // Unsharp mask: kernel intensity scales with `amount` (0..1)
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);
    const k = amount * 1.2; // sharpening strength multiplier
    // 3x3 kernel: center boosted, neighbors negative
    const center = 1 + 4 * k;
    const edge = -k;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          if (amount === 0) {
            out[idx + c] = src[idx + c];
            continue;
          }
          let sum = src[idx + c] * center;
          sum += getPixel(src, w, h, x, y - 1, c) * edge;
          sum += getPixel(src, w, h, x, y + 1, c) * edge;
          sum += getPixel(src, w, h, x - 1, y, c) * edge;
          sum += getPixel(src, w, h, x + 1, y, c) * edge;
          out[idx + c] = clamp(sum, 0, 255);
        }
        out[idx + 3] = src[idx + 3];
      }
    }
    return new ImageData(out, w, h);
  }

  function applyDenoise(imageData, w, h, amount) {
    // Simple box blur blended with original based on `amount`
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0, count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += getPixel(src, w, h, x + dx, y + dy, c);
              count++;
            }
          }
          const blurred = sum / count;
          out[idx + c] = src[idx + c] * (1 - amount * 0.6) + blurred * (amount * 0.6);
        }
        out[idx + 3] = src[idx + 3];
      }
    }
    return new ImageData(out, w, h);
  }

  function getPixel(data, w, h, x, y, channel) {
    x = clamp(x, 0, w - 1);
    y = clamp(y, 0, h - 1);
    return data[(y * w + x) * 4 + channel];
  }

  /* ============ AI Enhancement via Hugging Face Inference API ============ */
  // Free Swin2SR super-resolution model (x4 real-world)
  const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/caidas/swin2SR-realworld-sr-x4-64';

  async function enhanceWithAI(file) {
    if (!hfApiKey) throw new Error('NO_API_KEY');

    const arrayBuffer = await file.arrayBuffer();

    const response = await fetch(HF_MODEL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfApiKey}`,
        'Content-Type': file.type,
      },
      body: arrayBuffer,
    });

    if (response.status === 503) {
      // Model is loading (cold start)
      throw new Error('MODEL_LOADING');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_KEY');
    }
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      // Sometimes HF returns JSON errors with 200 status in edge cases
      throw new Error('INVALID_RESPONSE');
    }
    return await blobToDataUrl(blob);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /* ============ Post-process AI result with local settings ============ */
  function applyLocalSettingsToDataUrl(dataUrl, settings) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        const result = await processImageLocally(img, settings);
        resolve(result);
      };
      img.src = dataUrl;
    });
  }

  /* ============ Main Enhance Handler ============ */
  let isProcessing = false;

  enhanceBtn.addEventListener('click', async () => {
    if (!currentFile || !currentImageEl || isProcessing) return;
    isProcessing = true;
    enhanceBtn.disabled = true;
    downloadBtn.disabled = true;

    const settings = {
      sharpness: Number(sharpnessRange.value),
      contrast: Number(contrastRange.value),
      denoise: Number(denoiseRange.value),
    };

    afterPlaceholder.classList.add('hidden');
    setStatus(true, 'Préparation de l\'image…', 8);

    try {
      let resultDataUrl;

      if (hfApiKey) {
        // Try AI path
        setStatus(true, 'Connexion à l\'IA Hugging Face…', 20);
        try {
          setStatus(true, 'L\'IA analyse les détails de l\'image…', 45);
          const aiResult = await enhanceWithAI(currentFile);
          setStatus(true, 'Finalisation des réglages…', 85);
          resultDataUrl = await applyLocalSettingsToDataUrl(aiResult, settings);
          setStatus(true, 'Terminé !', 100);
          showToast('Image améliorée par l\'IA avec succès.', 'success');
        } catch (aiErr) {
          console.warn('AI enhancement failed, falling back to local processing:', aiErr);
          let fallbackMsg = 'IA indisponible, traitement local utilisé.';
          if (aiErr.message === 'MODEL_LOADING') {
            fallbackMsg = 'Le modèle IA démarre (cold start), traitement local utilisé pour cette fois.';
          } else if (aiErr.message === 'INVALID_KEY') {
            fallbackMsg = 'Clé API invalide. Traitement local utilisé.';
          }
          showToast(fallbackMsg, 'warn', 5000);

          setStatus(true, 'Traitement local en cours…', 55);
          resultDataUrl = await processImageLocally(currentImageEl, settings);
          setStatus(true, 'Terminé !', 100);
        }
      } else {
        // No API key — go straight to local fallback
        setStatus(true, 'Traitement local (Canvas) en cours…', 35);
        await sleep(300); // perceptible feedback
        setStatus(true, 'Amélioration de la netteté…', 60);
        resultDataUrl = await processImageLocally(currentImageEl, settings);
        setStatus(true, 'Ajustement du contraste…', 90);
        await sleep(200);
        setStatus(true, 'Terminé !', 100);
        showToast('Image améliorée localement (sans clé API).', 'success');
      }

      enhancedDataUrl = resultDataUr