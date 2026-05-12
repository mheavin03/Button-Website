// 2in round sticker version (no inner circle)
// Based on 2in button logic, but image fits the cut circle (outer) and no inner ring is shown
function parsePxVar(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'string') val = val.trim();
  if (val.endsWith('px')) val = val.slice(0, -2);
  var num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}
(function(){
  'use strict';
  var SHOW_DELETE_CONFIRM = false;
  var USE_OBJECT_URLS = true;
  try {
    if (location.origin === 'null' || (location.protocol !== 'http:' && location.protocol !== 'https:')) {
      USE_OBJECT_URLS = false;
      console.log('[env] forcing DataURL mode due to origin/protocol', { origin: location.origin, protocol: location.protocol });
    }
  } catch(e) { USE_OBJECT_URLS = false; }

  var COLS = 3, ROWS = 4;
  var root = document.documentElement;
  function setVar(name, val){ root.style.setProperty(name, val); }
  // Sticker defaults: single 2.5" circle (inner == outer), small gap
  setVar('--cols', COLS);
  setVar('--rows', ROWS);
  setVar('--inner-dia-in', 2.5);
  setVar('--outer-dia-in', 2.5);
  setVar('--inner-dia', 'calc(2.5 * 96px)');
  setVar('--outer-dia', 'calc(2.5 * 96px)');
  // Independent gaps defaults
  setVar('--gap-x-in', 0.15);
  setVar('--gap-y-in', 0.15);
  setVar('--gap-x', 'calc(0.15 * 96px)');
  setVar('--gap-y', 'calc(0.15 * 96px)');
  // Legacy fallback
  setVar('--gap-in', 0.15);
  setVar('--gap', 'calc(0.15 * 96px)');

  var pages = [];
  var pagesWrap = document.getElementById('pages');

  function createEmptyState(){
    return Array.from({ length: COLS * ROWS }, function(){ return { img: null, fit: 'contain', scale: 1, nx: 0, ny: 0 }; });
  }

  function createPage(){
    var pageEl = document.createElement('div');
    pageEl.className = 'page';
    var gridEl = document.createElement('div');
    gridEl.className = 'grid';
    pageEl.appendChild(gridEl);
    var page = { state: createEmptyState(), cells: [], pageEl: pageEl, gridEl: gridEl };
    var delBtn = document.createElement('button');
    delBtn.className = 'page-del';
    delBtn.textContent = 'Delete page';
    delBtn.addEventListener('click', function(){ if (SHOW_DELETE_CONFIRM && !confirm('Delete this page?')) return; deletePage(page); });
    pageEl.appendChild(delBtn);
    buildGridForPage(page);
    pages.push(page);
    pagesWrap.appendChild(pageEl);
    return page;
  }

  function buildGridForPage(page){
    page.gridEl.innerHTML = '';
    page.cells.length = 0;
    for(var i=0; i<page.state.length; i++){
      (function(i){
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        cell.tabIndex = 0;
        cell.setAttribute('role', 'button');
        cell.setAttribute('aria-label', 'Sticker circle ' + (i+1));

        var empty = document.createElement('div');
        empty.className = 'empty';
        empty.innerHTML = 'Click to add image or drop file';
        cell.appendChild(empty);

        var imgWrap = document.createElement('div');
        imgWrap.className = 'img-wrap';
        var fitBox = document.createElement('div');
        fitBox.className = 'fit-box';
        var img = document.createElement('img');
        img.decoding = 'async';
        img.loading = 'eager';
        img.draggable = false;
        fitBox.appendChild(img);
        imgWrap.appendChild(fitBox);
        cell.appendChild(imgWrap);

        var ringOuter = document.createElement('div');
        ringOuter.className = 'ring-outer';
        cell.appendChild(ringOuter);
        // No inner ring for stickers

        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.className = 'file-overlay';
        input.addEventListener('change', function(e){
          var file = e.target.files && e.target.files[0];
          var idx = i;
          if(!file){ input.blur(); return; }
          var mime = (file.type || '').toLowerCase();
          if(!mime.startsWith('image/') || mime.indexOf('heic') !== -1 || mime.indexOf('heif') !== -1){ alert('Use JPG/PNG/WebP.'); input.value=''; input.blur(); return; }
          if (USE_OBJECT_URLS) {
            try {
              var objectUrl = URL.createObjectURL(file);
              if ((objectUrl || '').indexOf('blob:null') === 0) { throw new Error('null-blob-objecturl'); }
              loadImageToCell(page, idx, objectUrl).catch(function(err){
                console.warn('[objectURL failed, fallback to dataURL]', err);
                return fileToDataURL(file).then(function(dataURL){ return loadImageToCell(page, idx, dataURL); });
              }).finally(function(){ input.value=''; input.blur(); });
            } catch(ex){
              console.warn('[ObjectURL path failed early]', ex);
              fileToDataURL(file).then(function(dataURL){ return loadImageToCell(page, idx, dataURL); }).finally(function(){ input.value=''; input.blur(); });
            }
          } else {
            fileToDataURL(file).then(function(dataURL){ return loadImageToCell(page, idx, dataURL); }).finally(function(){ input.value=''; input.blur(); });
          }
        });
        cell.appendChild(input);

        cell.addEventListener('keydown', function(ev){
          if (ev.key === 'Enter' || ev.key === ' ') {
            if (page.state[i].img) { ev.preventDefault(); return; }
            ev.preventDefault();
            input.click();
          }
        });

        img.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); });
        input.addEventListener('click', function(ev){ ev.stopPropagation(); });

        var tb = document.createElement('div');
        tb.className = 'toolbar';
        var delBtn = document.createElement('button'); delBtn.textContent = '✕';
        var zoomOutBtn = document.createElement('button'); zoomOutBtn.textContent = '−';
        var zoomInBtn = document.createElement('button'); zoomInBtn.textContent = '+';
        var centerBtn = document.createElement('button'); centerBtn.textContent = 'Center';
  tb.appendChild(zoomOutBtn);
  tb.appendChild(zoomInBtn);
  tb.appendChild(centerBtn);
  // Add delete button to toolbar (first position)
  tb.insertBefore(delBtn, tb.firstChild);
        cell.appendChild(tb);
  // Add duplicate button in top-right
  var dupBtn = document.createElement('button'); dupBtn.className = 'dup-btn'; dupBtn.title = 'Duplicate to next empty cell'; dupBtn.textContent = '⧉';
  cell.appendChild(dupBtn);

        zoomInBtn.addEventListener('click', function(e){ e.stopPropagation(); adjustZoom(page, i, 1.1); });
        zoomOutBtn.addEventListener('click', function(e){ e.stopPropagation(); adjustZoom(page, i, 1/1.1); });
        centerBtn.addEventListener('click', function(e){ e.stopPropagation(); resetTransform(page, i); });

        // Drag to pan
        (function(){
          var isDown = false, startX = 0, startY = 0, baseNx = 0, baseNy = 0;
          var imgEl = img;
          imgEl.addEventListener('pointerdown', function(ev){
            if(!page.state[i].img) return;
            isDown = true; startX = ev.clientX; startY = ev.clientY; baseNx = page.state[i].nx||0; baseNy = page.state[i].ny||0;
            imgEl.setPointerCapture(ev.pointerId); ev.preventDefault();
          });
          imgEl.addEventListener('pointermove', function(ev){
            if(!isDown) return;
            var dx = ev.clientX - startX; var dy = ev.clientY - startY;
            var outerDiaStr = getComputedStyle(root).getPropertyValue('--outer-dia');
            var previewScaleStr = getComputedStyle(root).getPropertyValue('--preview-scale');
            var outerPx = parsePxVar(outerDiaStr, 192);
            var previewScale = parseFloat(previewScaleStr) || 0.9;
            var denom = outerPx * previewScale;
            var nx = baseNx + dx / denom; var ny = baseNy + dy / denom;
            setOffset(page, i, nx, ny);
          });
          imgEl.addEventListener('pointerup', function(ev){ isDown = false; try{ imgEl.releasePointerCapture(ev.pointerId); }catch(_){ } });
          imgEl.addEventListener('pointercancel', function(ev){ isDown = false; try{ imgEl.releasePointerCapture(ev.pointerId); }catch(_){ } });
          // Pinch-to-zoom (wheel+ctrl)
          cell.addEventListener('wheel', function(ev){
            if (!page.state[i].img) return;
            if (!ev.ctrlKey && !ev.metaKey) return;
            ev.preventDefault();
            var factor = Math.pow(1.0015, -ev.deltaY);
            adjustZoom(page, i, factor);
          }, { passive: false });
        })();

        cell.addEventListener('dragover', function(e){ e.preventDefault(); this.style.outline = '2px solid #77aaff'; });
        cell.addEventListener('dragleave', function(){ this.style.outline = ''; });
        cell.addEventListener('drop', function(e){
          e.preventDefault(); this.style.outline = '';
          var file = e.dataTransfer.files && e.dataTransfer.files[0];
          var idx = i;
          if(!file) return;
          var mime = (file.type || '').toLowerCase();
          if(!mime.startsWith('image/') || mime.indexOf('heic') !== -1 || mime.indexOf('heif') !== -1){ alert('Use JPG/PNG/WebP.'); return; }
          if (USE_OBJECT_URLS) {
            try {
              var objectUrl = URL.createObjectURL(file);
              if ((objectUrl || '').indexOf('blob:null') === 0) { throw new Error('null-blob-objecturl'); }
              loadImageToCell(page, idx, objectUrl).catch(function(err){
                console.warn('[drop objectURL failed, fallback to dataURL]', err);
                return fileToDataURL(file).then(function(dataURL){ return loadImageToCell(page, idx, dataURL); });
              });
            } catch(ex){
              console.warn('[drop ObjectURL path failed early]', ex);
              fileToDataURL(file).then(function(dataURL){ return loadImageToCell(page, idx, dataURL); });
            }
          } else {
            fileToDataURL(file).then(function(dataURL){ return loadImageToCell(page, idx, dataURL); });
          }
        });

        delBtn.addEventListener('click', function(e){ e.stopPropagation(); clearCell(page, i); });
  dupBtn.addEventListener('click', function(e){ e.stopPropagation(); duplicateToNext(page, i); });
        page.gridEl.appendChild(cell);
        page.cells.push({ cell: cell, empty: empty, imgWrap: imgWrap, img: img, fitBox: fitBox, tb: tb, input: input });
        // Ensure fitBox uses the outer diameter size in preview
        fitBox.style.width = 'calc(var(--outer-dia) * var(--preview-scale))';
        fitBox.style.height = 'calc(var(--outer-dia) * var(--preview-scale))';
        applyTransformVars(page, i);
      })(i);
    }
  }

  var page0 = createPage();
  document.getElementById('addPage').addEventListener('click', function(){ createPage(); });

  function deletePage(page){
    var idx = pages.indexOf(page);
    if(idx === -1) return;
    try { pagesWrap.removeChild(page.pageEl); } catch(_){ }
    pages.splice(idx, 1);
    if(pages.length === 0){ createPage(); }
  }

  var bulkInputEl = document.getElementById('bulkInput');
  bulkInputEl.addEventListener('change', function(e){
    var files = Array.prototype.slice.call(e.target.files || []).filter(function(f){ return (f && (f.type||'').toLowerCase().indexOf('image/') === 0); });
    if(!files.length) return;
    bulkAddFilesAllPages(files).finally(function(){ try { e.target.value=''; } catch(_){} });
  });

  function countEmptySlots(){
    var n = 0; pages.forEach(function(pg){ for(var i=0;i<pg.state.length;i++){ if(!pg.state[i].img) n++; } });
    return n;
  }
  function planPagesNeeded(currentEmpty, filesCount){
    if(filesCount <= currentEmpty) return 0;
    var perPage = COLS * ROWS;
    return Math.ceil((filesCount - currentEmpty) / perPage);
  }
  function ensurePagesForCount(filesCount){
    var empty = countEmptySlots();
    var need = planPagesNeeded(empty, filesCount);
    for(var i=0;i<need;i++){ createPage(); }
    if(need>0){ console.log('[bulk add] created extra pages:', need, 'for files:', filesCount); }
    return need;
  }
  function bulkAddFilesAllPages(files){
    ensurePagesForCount(files.length);
    var targets = [];
    pages.forEach(function(pg){
      for(var i=0;i<pg.state.length;i++){ if(!pg.state[i].img) targets.push({ pg: pg, idx: i }); }
    });
    var maxN = Math.min(files.length, targets.length);
    if(maxN === 0){ console.warn('[bulk add] no empty cells across pages'); return Promise.resolve(); }
    var chain = Promise.resolve();
    for(var k=0;k<maxN;k++){
      (function(k){
        var t = targets[k];
        var file = files[k];
        chain = chain.then(function(){
          if (USE_OBJECT_URLS) {
            try {
              var u = URL.createObjectURL(file);
              if ((u || '').indexOf('blob:null') === 0) { throw new Error('null-blob-objecturl'); }
              return loadImageToCell(t.pg, t.idx, u).catch(function(){
                return fileToDataURL(file).then(function(d){ return loadImageToCell(t.pg, t.idx, d); });
              });
            } catch(ex){
              return fileToDataURL(file).then(function(d){ return loadImageToCell(t.pg, t.idx, d); });
            }
          } else {
            return fileToDataURL(file).then(function(d){ return loadImageToCell(t.pg, t.idx, d); });
          }
        });
      })(k);
    }
    return chain;
  }
  function findNextEmptySlot(startPage, startIdx){
    var pIndex = pages.indexOf(startPage);
    if (pIndex < 0) pIndex = 0;
    for (var i=startIdx+1; i<startPage.state.length; i++){ if(!startPage.state[i].img) return { pg:startPage, idx:i }; }
    for (var p=pIndex+1; p<pages.length; p++){
      for (var j=0; j<pages[p].state.length; j++){ if(!pages[p].state[j].img) return { pg: pages[p], idx:j }; }
    }
    var newPg = createPage();
    return { pg: newPg, idx: 0 };
  }
  function duplicateToNext(page, index){
    var st = page.state[index]; if (!st.img) return;
    var target = findNextEmptySlot(page, index);
    loadImageToCell(target.pg, target.idx, st.img).then(function(){
      target.pg.state[target.idx].fit = st.fit;
      target.pg.state[target.idx].scale = st.scale;
      target.pg.state[target.idx].nx = st.nx;
      target.pg.state[target.idx].ny = st.ny;
      applyTransformVars(target.pg, target.idx);
    }).catch(function(err){ console.warn('Duplicate failed', err); });
  }

  function fileToDataURL(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){ resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function clearCell(page, index){
    page.state[index].img = null;
    page.state[index].scale = 1; page.state[index].nx = 0; page.state[index].ny = 0;
    var ref = page.cells[index];
    ref.imgWrap.style.display = 'none';
    ref.empty.style.display = '';
    ref.cell.classList.remove('has-image');
    applyTransformVars(page, index);
  }

  function loadImageToCell(page, index, src){
    return new Promise(function(resolve, reject){
      var ref = page.cells[index];
      if(!ref){ console.error('[loadImageToCell] invalid index', index); return reject(new Error('invalid index')); }
      var imgEl = ref.img;
      function cleanup(){ imgEl.onload = null; imgEl.onerror = null; }
      imgEl.onload = function(){
        page.state[index].img = src;
        page.state[index].scale = 1; page.state[index].nx = 0; page.state[index].ny = 0;
        applyTransformVars(page, index);
        ref.imgWrap.style.display = 'block';
        ref.empty.style.display = 'none';
        ref.cell.classList.add('has-image');
        cleanup();
        resolve();
      };
      imgEl.onerror = function(e){ cleanup(); alert('Image failed to load. Try a JPG/PNG/WebP.'); reject(e); };
      if (imgEl.src === src) {
        imgEl.src = '';
        setTimeout(function(){ imgEl.src = src; if (imgEl.complete && imgEl.naturalWidth > 0) { imgEl.onload(); } }, 0);
      } else {
        imgEl.src = src;
        if (imgEl.complete && imgEl.naturalWidth > 0) { imgEl.onload(); }
      }
    });
  }

  document.getElementById('clearAll').addEventListener('click', function(){
    pages.forEach(function(pg){ for(var i=0;i<pg.state.length;i++){ clearCell(pg, i); } });
  });

  var gapXInput = document.getElementById('gapX');
  var gapYInput = document.getElementById('gapY');
  var dpiInput = document.getElementById('dpi');
  var scaleInput = document.getElementById('scale');
  function applySettings(){
    setVar('--gap-x-in', gapXInput.value);
    setVar('--gap-y-in', gapYInput.value);
    setVar('--gap-x', 'calc(' + gapXInput.value + ' * 96px)');
    setVar('--gap-y', 'calc(' + gapYInput.value + ' * 96px)');
    // legacy
    setVar('--gap-in', gapYInput.value);
    setVar('--gap', 'calc(' + gapYInput.value + ' * 96px)');
    setVar('--dpi', dpiInput.value);
    setVar('--preview-scale', scaleInput.value);
    pages.forEach(function(pg){ for(var i=0;i<pg.state.length;i++){ applyTransformVars(pg, i); } });
  }
  [gapXInput, gapYInput, dpiInput, scaleInput].forEach(function(i){ i.addEventListener('input', applySettings); });
  applySettings();

  function sanitizeFilename(text){
    var t = (text || '').toString();
    t = t.replace(/×/g,'x');
    t = t.replace(/[“”]/g,'"').replace(/[‘’]/g,"'");
    t = t.replace(/\s+—\s+/g,'-');
    t = t.replace(/[^a-z0-9._-]+/gi,'-');
    t = t.replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'');
    if (!t) t = 'export';
    if (!/\.pdf$/i.test(t)) t += '.pdf';
    return t;
  }
  function getExportFilename(defaultName){
    var h1 = document.getElementById('title') || document.querySelector('h1');
    if (h1) return sanitizeFilename(h1.textContent || h1.innerText || defaultName);
    return sanitizeFilename(defaultName || 'export.pdf');
  }

  function showFilenamePrompt(initialName){
    return new Promise(function(resolve){
      var existing = document.getElementById('filenamePromptOverlay');
      if (existing) existing.remove();
      var overlay = document.createElement('div');
      overlay.id = 'filenamePromptOverlay';
      overlay.className = 'modal-overlay';
      var modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = '<h3>Confirm Export Filename</h3>'+
        '<div class="field">'+
        '<label for="filenamePromptInput">Filename</label>'+
        '<input id="filenamePromptInput" type="text" autocomplete="off" spellcheck="false" />'+
        '</div>'+
        '<div class="actions">'+
        '<button class="btn cancel" type="button">Cancel</button>'+
        '<button class="btn ok" type="button">Save PDF</button>'+
        '</div>';
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      var input = modal.querySelector('#filenamePromptInput');
      var btnOk = modal.querySelector('.btn.ok');
      var btnCancel = modal.querySelector('.btn.cancel');
      input.value = initialName || 'export.pdf';
      setTimeout(function(){ try{ input.focus(); input.select(); }catch(_){ } }, 0);
      function cleanup(){ try{ overlay.remove(); }catch(_){ } }
      function confirm(){ var v = (input.value||'').trim(); if(!v){ input.focus(); return; } resolve(sanitizeFilename(v)); cleanup(); }
      function cancel(){ resolve(null); cleanup(); }
      btnOk.addEventListener('click', confirm);
      btnCancel.addEventListener('click', cancel);
      overlay.addEventListener('click', function(e){ if(e.target === overlay) cancel(); });
      input.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); confirm(); } else if(e.key === 'Escape'){ e.preventDefault(); cancel(); } });
    });
  }

  document.getElementById('exportPDF').addEventListener('click', function(){
    var proposed = getExportFilename('sticker-2in-3x4.pdf');
    showFilenamePrompt(proposed).then(function(chosen){
      if(!chosen) return;
      var filename = sanitizeFilename(chosen);
      var g = computeExportGeometry();
      var pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'pt', format: [8.5*72, 11*72] });
      function renderOnePage(pageIndex){
      var page = pages[pageIndex];
      var canvas = document.createElement('canvas');
      canvas.width = g.pageWpx; canvas.height = g.pageHpx;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, g.pageWpx, g.pageHpx);
      function drawCell(r, c){
        if(r >= ROWS){
          var imgData = canvas.toDataURL('image/jpeg', 0.95);
          if(pageIndex > 0) pdf.addPage([8.5*72, 11*72], 'p');
          pdf.addImage(imgData, 'JPEG', 0, 0, 8.5*72, 11*72);
          if(pageIndex+1 < pages.length){ renderOnePage(pageIndex+1); } else { pdf.save(filename); }
          return;
        }
        var i = r*COLS + c;
  var x = g.marginX + c*(g.outerDiaPx + g.gapXPx);
  var y = g.marginY + r*(g.outerDiaPx + g.gapYPx);
        var cx = x + g.outerDiaPx/2;
        var cy = y + g.outerDiaPx/2;
        var outerR = g.outerDiaPx/2;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        var cellState = page.state[i];
        if(cellState.img){
          loadImage(cellState.img).then(function(img){
            var fit = cellState.fit || 'contain';
            var box = coverContainRect(img.width, img.height, g.outerDiaPx, g.outerDiaPx, fit);
            var s = cellState.scale || 1; var nx = cellState.nx || 0; var ny = cellState.ny || 0;
            var dw = box.dWidth * s; var dh = box.dHeight * s;
            var dx = cx - dw/2 + nx * g.outerDiaPx; var dy = cy - dh/2 + ny * g.outerDiaPx;
            ctx.drawImage(img, box.sx, box.sy, box.sWidth, box.sHeight, dx, dy, dw, dh);
            ctx.restore();
            ctx.lineWidth = 2; ctx.strokeStyle = '#2a49d0';
            ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.stroke();
            if(c+1 < COLS) { drawCell(r, c+1); } else { drawCell(r+1, 0); }
          }).catch(function(){
            ctx.fillStyle = '#eef2ff'; ctx.fillRect(x, y, g.outerDiaPx, g.outerDiaPx);
            ctx.restore();
            ctx.lineWidth = 2; ctx.strokeStyle = '#2a49d0';
            ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.stroke();
            if(c+1 < COLS) { drawCell(r, c+1); } else { drawCell(r+1, 0); }
          });
        } else {
          ctx.restore();
          ctx.lineWidth = 2; ctx.strokeStyle = '#2a49d0';
          ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI * 2); ctx.stroke();
          if(c+1 < COLS) { drawCell(r, c+1); } else { drawCell(r+1, 0); }
        }
      }
      drawCell(0,0);
    }
      if(pages.length === 0){ createPage(); }
      renderOnePage(0);
    });
  });

  function computeExportGeometry(){
    var DPI = parseInt(getComputedStyle(root).getPropertyValue('--dpi'), 10) || 300;
    var pageWpx = parseFloat(getComputedStyle(root).getPropertyValue('--page-width-in')) * DPI;
    var pageHpx = parseFloat(getComputedStyle(root).getPropertyValue('--page-height-in')) * DPI;
    var gapXIn = parseFloat(getComputedStyle(root).getPropertyValue('--gap-x-in'));
    var gapYIn = parseFloat(getComputedStyle(root).getPropertyValue('--gap-y-in'));
    if (!isFinite(gapXIn)) gapXIn = parseFloat(getComputedStyle(root).getPropertyValue('--gap-in'));
    if (!isFinite(gapYIn)) gapYIn = parseFloat(getComputedStyle(root).getPropertyValue('--gap-in'));
    var gapXPx = gapXIn * DPI;
    var gapYPx = gapYIn * DPI;
    var outerDiaPx = parseFloat(getComputedStyle(root).getPropertyValue('--outer-dia-in')) * DPI; // equals inner
    return {
      DPI: DPI,
      pageWpx: pageWpx,
      pageHpx: pageHpx,
      gapXPx: gapXPx,
      gapYPx: gapYPx,
      innerDiaPx: outerDiaPx,
      outerDiaPx: outerDiaPx,
      marginX: (pageWpx - (COLS * outerDiaPx + (COLS - 1) * gapXPx)) / 2,
      marginY: (pageHpx - (ROWS * outerDiaPx + (ROWS - 1) * gapYPx)) / 2
    };
  }

  function loadImage(src){
    return new Promise(function(resolve, reject){
      var img = new Image(); img.onload = function(){ resolve(img); }; img.onerror = reject; img.src = src;
    });
  }

  function coverContainRect(srcW, srcH, destW, destH, mode){
    mode = mode || 'cover';
    var srcRatio = srcW / srcH; var destRatio = destW / destH; var dWidth, dHeight;
    if(mode === 'contain'){
      if(srcRatio > destRatio){ dWidth = destW; dHeight = destW / srcRatio; }
      else { dHeight = destH; dWidth = destH * srcRatio; }
      return { sx: 0, sy: 0, sWidth: srcW, sHeight: srcH, dx: 0, dy: 0, dWidth: dWidth, dHeight: dHeight };
    } else {
      if(srcRatio > destRatio){ var targetH = srcH; var targetW = targetH * destRatio; var sx = Math.floor((srcW - targetW)/2);
        return { sx: sx, sy: 0, sWidth: targetW, sHeight: targetH, dx: 0, dy: 0, dWidth: destW, dHeight: destH };
      } else { var targetW = srcW; var targetH = targetW / destRatio; var sy = Math.floor((srcH - targetH)/2);
        return { sx: 0, sy: sy, sWidth: targetW, sHeight: targetH, dx: 0, dy: 0, dWidth: destW, dHeight: destH };
      }
    }
  }

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  function applyTransformVars(page, index){
    var ref = page.cells[index]; var st = page.state[index];
    var scale = st.scale || 1; var nx = st.nx || 0; var ny = st.ny || 0;
    var outerDiaStr = getComputedStyle(root).getPropertyValue('--outer-dia');
    var previewScaleStr = getComputedStyle(root).getPropertyValue('--preview-scale');
    var outerPx = parsePxVar(outerDiaStr, 192); var previewScale = parseFloat(previewScaleStr) || 0.9;
    var outerPxPreview = outerPx * previewScale;
    if (!ref.fitBox && ref.cell) { ref.fitBox = ref.cell.querySelector('.fit-box'); }
    if (ref.fitBox) {
      ref.fitBox.style.setProperty('--scale', scale);
      ref.fitBox.style.setProperty('--tx', (nx * outerPxPreview) + 'px');
      ref.fitBox.style.setProperty('--ty', (ny * outerPxPreview) + 'px');
      ref.fitBox.style.cssText += '; --scale:'+scale+'; --tx:'+(nx * outerPxPreview)+'px; --ty:'+(ny * outerPxPreview)+'px;';
    }
    if (ref.img) { ref.img.style.objectFit = (st.fit === 'contain') ? 'contain' : 'cover'; }
  }

  function adjustZoom(page, index, factor){ var st = page.state[index]; st.scale = clamp((st.scale || 1) * factor, 0.2, 5); applyTransformVars(page, index); }
  function setOffset(page, index, nx, ny){ var st = page.state[index]; st.nx = clamp(nx, -1.0, 1.0); st.ny = clamp(ny, -1.0, 1.0); applyTransformVars(page, index); }
  function resetTransform(page, index){ var st = page.state[index]; st.scale = 1; st.nx = 0; st.ny = 0; applyTransformVars(page, index); }

  // Override sanitize with robust Unicode handling
  function sanitizeFilename(text){
    var t = (text || '').toString();
    t = t.replace(/\u00D7/g,'x');
    t = t.replace(/[\u201C\u201D]/g,'"').replace(/[\u2018\u2019]/g,"'");
    t = t.replace(/[\u2014\u2013]/g,'-');
    t = t.replace(/\s+/g,' ').trim();
    t = t.replace(/[^a-z0-9._-]+/gi,'-');
    t = t.replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'');
    if (!t) t = 'export';
    if (!/\.pdf$/i.test(t)) t += '.pdf';
    return t;
  }
})();
