function parsePxVar(val, fallback) {

  if (!val) return fallback;

  if (typeof val === 'string') {
    val = val.trim();

    // Handle CSS calc() expressions such as:
    // calc(3 * 96px)
    var match = val.match(/^calc\(\s*([\d.]+)\s*\*\s*([\d.]+)px\s*\)$/);

    if (match) {
      return parseFloat(match[1]) * parseFloat(match[2]);
    }

    if (val.endsWith('px')) {
      val = val.slice(0, -2);
    }
  }

  var num = parseFloat(val);

  return isNaN(num) ? fallback : num;

}

function clamp(v, lo, hi) { 
    return Math.max(lo, Math.min(hi, v)); 
}

function loadImage(src){
    return new Promise(function(resolve, reject){
        var img = new Image(); 
        img.onload = function(){ resolve(img); }; 
        img.onerror = reject; 
        img.src = src;
    });
}

function coverContainRect(srcW, srcH, destW, destH, mode) {
    mode = mode || 'cover';

    var srcRatio = srcW / srcH; 
    var destRatio = destW / destH; 
    var dWidth, dHeight;

    if(mode === 'contain'){
        if(srcRatio > destRatio) { 
            dWidth = destW; 
            dHeight = destW / srcRatio; 
        }
        else { 
            dHeight = destH; 
            dWidth = destH * srcRatio; 
        }
        return { sx: 0, sy: 0, sWidth: srcW, sHeight: srcH, dx: 0, dy: 0, dWidth: dWidth, dHeight: dHeight };
    } 
    else {
        if(srcRatio > destRatio) { 
            var targetH = srcH; 
            var targetW = targetH * destRatio; 
            var sx = Math.floor((srcW - targetW)/2);
            return { sx: sx, sy: 0, sWidth: targetW, sHeight: targetH, dx: 0, dy: 0, dWidth: destW, dHeight: destH };
        } 
        else { 
            var targetW = srcW; 
            var targetH = targetW / destRatio; 
            var sy = Math.floor((srcH - targetH)/2);
            return { sx: 0, sy: sy, sWidth: targetW, sHeight: targetH, dx: 0, dy: 0, dWidth: destW, dHeight: destH };
        }
    }
}

function updateTransformVars(page, index, root, template){
    var ref = page.cells[index];
    var st = page.state[index];

    var scale = st.scale || 1; 
    var nx = st.nx || 0; 
    var ny = st.ny || 0;
    
    var fitDiaStr = getComputedStyle(root).getPropertyValue(
      template.imageFitDiameter === 'inner'
        ? '--inner-dia'
        : '--outer-dia'
    );
    
    var fitPx = parsePxVar(fitDiaStr, 192);

    var previewScaleStr = 
      getComputedStyle(root).getPropertyValue('--preview-scale');

    var previewScale = parseFloat(previewScaleStr) || 0.9;

    var fitPxPreview = fitPx * previewScale;

    if (!ref.fitBox && ref.cell) {
      ref.fitBox = ref.cell.querySelector('.fit-box');
    }

    if (ref.fitBox) {
      ref.fitBox.style.setProperty('--scale', scale);
      ref.fitBox.style.setProperty('--tx', (nx * fitPxPreview) + 'px');
      ref.fitBox.style.setProperty('--ty', (ny * fitPxPreview) + 'px');
      ref.fitBox.style.cssText += `; --scale:${scale}; --tx:${nx * fitPxPreview}px; --ty:${ny * fitPxPreview}px;`;
    }

    if (ref.img) {
      ref.img.style.objectFit = (st.fit === 'contain') ? 'contain' : 'cover';
    }
}

function sharedAdjustZoom(page, index, factor, root, template){
    var st = page.state[index];
    st.scale = clamp((st.scale || 1) * factor, 0.2, 5);
    updateTransformVars(page, index, root, template);
}

function sharedSetOffset(page, index, nx, ny, root, template){
    var st = page.state[index];
    st.nx = clamp(nx, -1.0, 1.0);
    st.ny = clamp(ny, -1.0, 1.0);
    updateTransformVars(page, index, root, template);
}

function sharedResetTransform(page, index, root, template) { 
    var st = page.state[index]; 
    st.scale = 1; 
    st.nx = 0; 
    st.ny = 0; 
    updateTransformVars(page, index, root, template); 
}

function sharedComputeExportGeometry(root, template){
    var DPI = 
        parseInt(getComputedStyle(root).getPropertyValue('--dpi'), 10) || 300;
    
    var pageWpx = 
        parseFloat(getComputedStyle(root).getPropertyValue('--page-width-in')) * DPI;
    var pageHpx = 
        parseFloat(getComputedStyle(root).getPropertyValue('--page-height-in')) * DPI;
    
    var gapXIn = 
        parseFloat(getComputedStyle(root).getPropertyValue('--gap-x-in'));
    var gapYIn = 
        parseFloat(getComputedStyle(root).getPropertyValue('--gap-y-in'));
    
    var gapXPx = gapXIn * DPI;
    var gapYPx = gapYIn * DPI;
    
    var innerDiaPx = 
        parseFloat(getComputedStyle(root).getPropertyValue('--inner-dia-in')) * DPI;
    var outerDiaPx = 
        parseFloat(getComputedStyle(root).getPropertyValue('--outer-dia-in')) * DPI;
    
    var gridW = template.cols * outerDiaPx + (template.cols - 1) * gapXPx;
    var gridH = template.rows * outerDiaPx + (template.rows - 1) * gapYPx;
    
    var marginX = (pageWpx - gridW) / 2;
    var marginY = (pageHpx - gridH) / 2;
    
    return { DPI: DPI, 
        pageWpx: pageWpx, 
        pageHpx: pageHpx, 
        gapXPx: gapXPx, 
        gapYPx: gapYPx, 
        innerDiaPx: innerDiaPx, 
        outerDiaPx: outerDiaPx, 
        marginX: marginX, 
        marginY: marginY, 
        gridW: gridW, 
        gridH: gridH 
    };
}

function createCellElements() {
    var cell = document.createElement('div');
    cell.className = 'cell';

    var empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = 'Click to add image or drop file';

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
    cell.appendChild(empty);
    cell.appendChild(imgWrap);

    return {
        cell: cell,
        empty: empty,
        imgWrap: imgWrap,
        fitBox: fitBox,
        img: img
    };
}

function isSupportedImageFile(file) {
    if(!file) return false;

    var mime = (file.type || '').toLowerCase();

    return (
        mime.startsWith('image/') &&
        mime.indexOf('heic') === -1 &&
        mime.indexOf('heif') === -1
    );
}

function fileToDataURL(file){
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();

        reader.onload = function(){ 
            resolve(reader.result); 
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);

    });
}

function loadFileWithFallback(file, useObjectUrls, loadSource) {
    if (useObjectUrls) {
        try {
            var objectUrl = URL.createObjectURL(file);

            if ((objectUrl || '').indexOf('blob:null') === 0) {
                throw new Error('null-blob-objecturl');
            }

            return loadSource(objectUrl).catch(function(err) {
                console.warn('[objectUrl  failed, fallback to dattaURL]', err);

                return fileToDataURL(file).then(function(dataURL){ 
                    return loadSource(dataURL); 
                });
            });
        } catch(ex) {
            console.warn('[ObjectURL path failed early]', ex);

            return fileToDataURL(file).then(function(dataURL) { 
                return loadSource(dataURL); 
            });
        }
        
        return fileToDataURL(file).then(function(dataURL) {
            return loadSource(dataURL);
        });
    }
}

function sharedLoadImageToCell(page, index, src, applyTransformVars){
    return new Promise(function(resolve, reject) {
      var ref = page.cells[index];

      if(!ref) { 
        console.error('[loadImageToCell] invalid index', index); 
        return reject(new Error('invalid index')); 
      }

      var imgEl = ref.img;

      function cleanup() { 
        imgEl.onload = null; 
        imgEl.onerror = null; 
      }

      imgEl.onload = function() {
        page.state[index].img = src;
        page.state[index].scale = 1; 
        page.state[index].nx = 0; 
        page.state[index].ny = 0;

        applyTransformVars(page, index);

        ref.imgWrap.style.display = 'block';
        ref.empty.style.display = 'none';
        ref.cell.classList.add('has-image');
        cleanup();
        resolve();
      };

      imgEl.onerror = function(e) { 
        cleanup(); 
        alert('Image failed to load. Try a JPG/PNG/WebP.'); 
        reject(e); 
      };

      if (imgEl.src === src) {
        imgEl.src = '';

        setTimeout(function() { 
          imgEl.src = src; 
          
          if (imgEl.complete && imgEl.naturalWidth > 0) { 
            imgEl.onload(); 
          } }, 0);
      } else {
        imgEl.src = src;

        if (imgEl.complete && imgEl.naturalWidth > 0) { 
          imgEl.onload(); 
        }
      }
    });
}

function sharedClearCell(page, index, applyTransformVars){
    page.state[index].img = null;
    page.state[index].scale = 1; 
    page.state[index].nx = 0; 
    page.state[index].ny = 0;

    var ref = page.cells[index];

    ref.imgWrap.style.display = 'none';
    ref.empty.style.display = '';
    ref.cell.classList.remove('has-image');
    
    applyTransformVars(page, index);
}

function sharedFindNextEmptySlot(pages, startPage, startIdx, createPage){
    var pIndex = pages.indexOf(startPage);

    if (pIndex < 0) {
      pIndex = 0;
    }

    for (var i=startIdx+1; i<startPage.state.length; i++) { 
      if(!startPage.state[i].img) {
        return { pg:startPage, idx:i }; 
      }
    }

    for (var p=pIndex+1; p<pages.length; p++) {
      for (var j=0; j<pages[p].state.length; j++) { 
        if(!pages[p].state[j].img) {
          return { pg: pages[p], idx:j };
        }
      }
    }

    var newPg = createPage();
    return { pg: newPg, idx: 0 };
  }

  function sharedDuplicateToNext(page, index, findNextEmptySlot, loadImageToCell, applyTransformVars){
    var st = page.state[index];

    if (!st.img) {
      return;
    }

    var target = findNextEmptySlot(page, index);

    loadImageToCell(target.pg, target.idx, st.img)
      .then(function() {
        target.pg.state[target.idx].fit = st.fit;
        target.pg.state[target.idx].scale = st.scale;
        target.pg.state[target.idx].nx = st.nx;
        target.pg.state[target.idx].ny = st.ny;

        applyTransformVars(target.pg, target.idx);
      })
      .catch(function(err) { 
        console.warn('Duplicate failed', err); 
      });
  }

  function sharedCreateEmptyState(cols, rows) {
    return Array.from(
        { length: cols * rows },
        function() {
            return {
                img: null,
                fit: 'contain',
                scale: 1, 
                nx: 0,
                ny: 0
            };
        }
    );
}

function sharedCreatePage(
    pages,
    pagesWrap,
    createEmptyState,
    buildGridForPage,
    deletePage,
    showDeleteConfirm
) {
    var pageEl = document.createElement('div');
    pageEl.className = 'page';

    var gridEl = document.createElement('div');
    gridEl.className = 'grid';

    pageEl.appendChild(gridEl);

    var page = { 
        state: createEmptyState(), 
        cells: [], 
        pageEl: pageEl, 
        gridEl: gridEl 
    };

    var delBtn = document.createElement('button');
    delBtn.className = 'page-del';
    delBtn.textContent = 'Delete page';

    delBtn.addEventListener('click', function(){ 
        if (showDeleteConfirm && !confirm('Delete this page?')) return; 
        deletePage(page); 
    });

    pageEl.appendChild(delBtn);

    buildGridForPage(page);

    pages.push(page);
    pagesWrap.appendChild(pageEl);

    return page;
}

function sharedDeletePage(page, pages, pagesWrap, createPage) {
  var idx = pages.indexOf(page);

  if (idx === -1) return;

  try {
    pagesWrap.removeChild(page.pageEl);
  } catch (_) {}

  pages.splice(idx, 1);

  if (pages.length === 0) {
    createPage();
  }
}

function setFitBoxSize(fitBox, template) {
    // Fit-box size is controlled entirely by CSS.
    // The CSS variable --preview-scale updates automatically on resize.
    // var fitVariable =
    //     template.imageFitDiameter === 'inner'
    //         ? '--inner-dia'
    //         : '--outer-dia';

    // fitBox.style.width =
    //     'calc(var(' + fitVariable + ') * var(--preview-scale))';

    // fitBox.style.height =
    //     'calc(var(' + fitVariable + ') * var(--preview-scale))';
}

function addRings(cell, template) {
  var ringOuter = document.createElement('div');
  ringOuter.className = 'ring-outer';
  cell.appendChild(ringOuter);

  if (template.showInnerRing) {
    var ringInner = document.createElement('div');
    ringInner.className = 'ring-inner';
    cell.appendChild(ringInner);
  }
}

function createToolbar() {
  var tb = document.createElement('div');
  tb.className = 'toolbar';

  var delBtn = document.createElement('button');
  delBtn.textContent = '✕';

  
  var zoomInBtn = document.createElement('button');
  zoomInBtn.textContent = '+';
  
  var centerBtn = document.createElement('button');
  centerBtn.textContent = 'Reset';

  var zoomOutBtn = document.createElement('button');
  zoomOutBtn.textContent = '−';

  tb.appendChild(delBtn);
  tb.appendChild(zoomInBtn);
  tb.appendChild(centerBtn);
  tb.appendChild(zoomOutBtn);

  return {
    toolbar: tb,
    deleteButton: delBtn,
    zoomOutButton: zoomOutBtn,
    zoomInButton: zoomInBtn,
    centerButton: centerBtn
  };
}

function createDuplicateButton() {
  var dupBtn = document.createElement('button');
  dupBtn.className = 'dup-btn';
  dupBtn.title = 'Duplicate to next empty cell';
  dupBtn.textContent = '⧉';

  return dupBtn;
}

function setupImageDrag(img, page, index, root, template, setOffset) {
  var isDown = false;
  var startX = 0;
  var startY = 0;
  var baseNx = 0;
  var baseNy = 0;

  img.addEventListener('pointerdown', function(ev) {
    if (!page.state[index].img) return;

    isDown = true;
    startX = ev.clientX;
    startY = ev.clientY;
    baseNx = page.state[index].nx || 0;
    baseNy = page.state[index].ny || 0;

    img.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });

  img.addEventListener('pointermove', function(ev) {
    if (!isDown) return;

    var dx = ev.clientX - startX;
    var dy = ev.clientY - startY;

    var fitDiaStr = getComputedStyle(root).getPropertyValue(
      template.imageFitDiameter === 'inner'
        ? '--inner-dia'
        : '--outer-dia'
    );

    var fitPx = parsePxVar(fitDiaStr, 192);

    var previewScaleStr =
      getComputedStyle(root).getPropertyValue('--preview-scale');

    var previewScale = parseFloat(previewScaleStr) || 0.9;

    var denom = fitPx * previewScale;

    var nx = baseNx + dx / denom;
    var ny = baseNy + dy / denom;

    setOffset(page, index, nx, ny);
  });

  img.addEventListener('pointerup', function(ev) {
    isDown = false;

    try {
      img.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  });

  img.addEventListener('pointercancel', function(ev) {
    isDown = false;

    try {
      img.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  });
}

function setupImageWheelZoom(imgWrap, page, index, adjustZoom) {
  imgWrap.addEventListener('wheel', function(ev) {
    if (!page.state[index].img) return;
    if (!ev.ctrlKey && !ev.metaKey) return;

    ev.preventDefault();

    var factor = Math.pow(1.0015, -ev.deltaY);
    adjustZoom(page, index, factor);
  }, { passive: false });
}

function sharedCountEmptySlots(pages) {
  var n = 0;

  pages.forEach(function(pg) {
    for (var i = 0; i < pg.state.length; i++) {
      if (!pg.state[i].img) {
        n++;
      }
    }
  });

  return n;
}

function sharedPlanPagesNeeded(currentEmpty, filesCount, cols, rows) {
  if (filesCount <= currentEmpty) {
    return 0;
  }

  var perPage = cols * rows;

  return Math.ceil(
    (filesCount - currentEmpty) / perPage
  );
}

function sharedEnsurePagesForCount(
  filesCount,
  pages,
  sharedCountEmptySlots,
  planPagesNeeded,
  createPage
) {
  var empty = sharedCountEmptySlots(pages);
  var need = planPagesNeeded(empty, filesCount);

  for (var i = 0; i < need; i++) {
    createPage();
  }

  if (need > 0) {
    console.log(
      '[bulk add] created extra pages:',
      need,
      'for files:',
      filesCount
    );
  }

  return need;
}

function sharedBulkAddFilesAllPages(
  files,
  pages,
  ensurePagesForCount,
  loadFileWithFallback,
  useObjectUrls,
  loadImageToCell
) {
  ensurePagesForCount(files.length);

  var targets = [];

  pages.forEach(function(pg) {
    for (var i = 0; i < pg.state.length; i++) {
      if (!pg.state[i].img) {
        targets.push({ pg: pg, idx: i });
      }
    }
  });

  var maxN = Math.min(files.length, targets.length);

  if (maxN === 0) {
    console.warn('[bulk add] no empty cells across pages');
    return Promise.resolve();
  }

  var chain = Promise.resolve();

  for (var k = 0; k < maxN; k++) {
    (function(k) {
      var t = targets[k];
      var file = files[k];

      chain = chain.then(function() {
        return loadFileWithFallback(
          file,
          useObjectUrls,
          function(src) {
            return loadImageToCell(t.pg, t.idx, src);
          }
        );
      });
    })(k);
  }

  return chain;
}

function sharedShowFilenamePrompt(initialName, sanitizeFilename) {
  return new Promise(function(resolve) {
    var existing = document.getElementById('filenamePromptOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'filenamePromptOverlay';
    overlay.className = 'modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'modal';

    modal.innerHTML =
      '<h3>Confirm Export Filename</h3>' +
      '<div class="field">' +
      '<label for="filenamePromptInput">Filename</label>' +
      '<input id="filenamePromptInput" type="text" autocomplete="off" spellcheck="false" />' +
      '</div>' +
      '<div class="actions">' +
      '<button class="btn cancel" type="button">Cancel</button>' +
      '<button class="btn ok" type="button">Save PDF</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var input = modal.querySelector('#filenamePromptInput');
    var btnOk = modal.querySelector('.btn.ok');
    var btnCancel = modal.querySelector('.btn.cancel');

    input.value = initialName || 'export.pdf';

    setTimeout(function() {
      try {
        input.focus();
        input.select();
      } catch (_) {}
    }, 0);

    function cleanup() {
      try {
        overlay.remove();
      } catch (_) {}
    }

    function confirm() {
      var v = (input.value || '').trim();

      if (!v) {
        input.focus();
        return;
      }

      resolve(sanitizeFilename(v));
      cleanup();
    }

    function cancel() {
      resolve(null);
      cleanup();
    }

    btnOk.addEventListener('click', confirm);
    btnCancel.addEventListener('click', cancel);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) cancel();
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
  });
}

function sharedGetExportFilename(defaultName, sanitizeFilename) {
  var h1 = document.getElementById('title') || document.querySelector('h1');

  if (h1) {
    return sanitizeFilename(
      h1.textContent || h1.innerText || defaultName
    );
  }

  return sanitizeFilename(defaultName || 'export.pdf');
}

function drawPdfCutGuides(ctx, g, template) {
  if (!template.cutGuideDirection) return;

  ctx.save();

  ctx.strokeStyle = '#888';
  ctx.lineWidth = Math.max(2, g.DPI / 150);
  ctx.setLineDash([g.DPI / 20, g.DPI / 20]);

  if (template.cutGuideDirection === 'vertical') {
    for (var c = 0; c < template.cols - 1; c++) {
      var x =
        g.marginX +
        (c + 1) * g.outerDiaPx +
        (c + 0.5) * g.gapXPx;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, g.pageHpx);
      ctx.stroke();
    }
  }

  if (template.cutGuideDirection === 'horizontal') {
    for (var r = 0; r < template.rows - 1; r++) {
      var y =
        g.marginY +
        (r + 1) * g.outerDiaPx +
        (r + 0.5) * g.gapYPx;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(g.pageWpx, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function getCellGeometry(g, row, col) {
  var x = g.marginX + col * (g.outerDiaPx + g.gapXPx);
  var y = g.marginY + row * (g.outerDiaPx + g.gapYPx);

  var cx = x + g.outerDiaPx / 2;
  var cy = y + g.outerDiaPx / 2;

  var outerR = g.outerDiaPx / 2;
  var innerR = g.innerDiaPx / 2;

  return {
    x: x,
    y: y,
    cx: cx,
    cy: cy,
    outerR: outerR,
    innerR: innerR
  };
}

function getImageDrawGeometry(img, cellState, g, template, cellGeometry) {
  var fit = cellState.fit || 'contain';

  var fitDiaPx =
    template.imageFitDiameter === 'inner'
      ? g.innerDiaPx
      : g.outerDiaPx;

  var box = coverContainRect(
    img.width,
    img.height,
    fitDiaPx,
    fitDiaPx,
    fit
  );

  var scale = cellState.scale || 1;
  var nx = cellState.nx || 0;
  var ny = cellState.ny || 0;

  var dw = box.dWidth * scale;
  var dh = box.dHeight * scale;

  var previewScale =
  parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--preview-scale')) || 0.9;

  var cssDpi = 96;
  var pdfToPreviewScale = (g.DPI / cssDpi) * previewScale;

  var fitDiaForOffset = fitDiaPx;

  var dx =
    cellGeometry.cx -
    dw / 2 +
    nx * fitDiaForOffset;

  var dy =
    cellGeometry.cy -
    dh / 2 +
    ny * fitDiaForOffset;

  return {
    box: box,
    dx: dx,
    dy: dy,
    dw: dw,
    dh: dh
  };
}

function drawPdfRings(ctx, cellGeometry, template) {
  ctx.lineWidth = 2;

  ctx.strokeStyle = '#2a49d0';
  ctx.beginPath();
  ctx.arc(
    cellGeometry.cx,
    cellGeometry.cy,
    cellGeometry.outerR,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  if (template.showInnerRingInPdf) {
    ctx.strokeStyle = '#e63c3c';
    ctx.beginPath();
    ctx.arc(
      cellGeometry.cx,
      cellGeometry.cy,
      cellGeometry.innerR,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
}

function sharedDrawPdfCell(
  ctx,
  cellState,
  cellGeometry,
  g,
  template,
  loadImage,
  onComplete
) {
  var outerR = cellGeometry.outerR;

  ctx.save();

  ctx.beginPath();
  ctx.arc(
    cellGeometry.cx,
    cellGeometry.cy,
    outerR,
    0,
    Math.PI * 2
  );
  ctx.closePath();
  ctx.clip();

  if (cellState.img) {
    loadImage(cellState.img).then(function(img) {
      var drawGeometry = getImageDrawGeometry(
        img,
        cellState,
        g,
        template,
        cellGeometry
      );

      ctx.drawImage(
        img,
        drawGeometry.box.sx,
        drawGeometry.box.sy,
        drawGeometry.box.sWidth,
        drawGeometry.box.sHeight,
        drawGeometry.dx,
        drawGeometry.dy,
        drawGeometry.dw,
        drawGeometry.dh
      );

      ctx.restore();
      drawPdfRings(ctx, cellGeometry, template);

      onComplete();

    }).catch(function() {
      ctx.fillStyle = '#eef2ff';

      ctx.fillRect(
        cellGeometry.x,
        cellGeometry.y,
        g.outerDiaPx,
        g.outerDiaPx
      );

      ctx.restore();
      drawPdfRings(ctx, cellGeometry, template);

      onComplete();
    });

  } else {
    ctx.restore();
    drawPdfRings(ctx, cellGeometry, template);
    onComplete();
  }
}

function sharedCreatePdfCanvas(g) {
  var canvas = document.createElement('canvas');

  canvas.width = g.pageWpx;
  canvas.height = g.pageHpx;

  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, g.pageWpx, g.pageHpx);

  return {
    canvas: canvas,
    ctx: ctx
  };
}

function sharedFinishPdfPage(
  pdf,
  canvas,
  pageIndex,
  pageCount,
  filename,
  renderNextPage
) {
  var imgData = canvas.toDataURL('image/jpeg', 0.95);

  if (pageIndex > 0) {
    pdf.addPage([8.5 * 72, 11 * 72], 'p');
  }

  pdf.addImage(
    imgData,
    'JPEG',
    0,
    0,
    8.5 * 72,
    11 * 72
  );

  if (pageIndex + 1 < pageCount) {
    renderNextPage();
  } else {
    pdf.save(filename);
  }
}

function sanitizeFilename(text) {
  var t = (text || '').toString();

  t = t.replace(/\u00D7/g, 'x');
  t = t.replace(/[\u201C\u201D]/g, '"');
  t = t.replace(/[\u2018\u2019]/g, "'");
  t = t.replace(/[\u2014\u2013]/g, '-');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/[^a-z0-9._-]+/gi, '-');
  t = t.replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');

  if (!t) t = 'export';
  if (!/\.pdf$/i.test(t)) t += '.pdf';

  return t;
}

function setCssVar(root, name, val) {
  root.style.setProperty(name, val);
}

function calculatePreviewScale(root, template) {
  var pageWidthIn = parseFloat(
    getComputedStyle(root).getPropertyValue('--page-width-in')
  );

  if (!pageWidthIn || pageWidthIn <= 0) {
    return template.previewScale || 0.9;
  }

  var pageWidthPx = pageWidthIn * 96;

  var stage = document.querySelector('.stage-wrap');
  var availableWidth = stage
    ? stage.clientWidth
    : window.innerWidth - 40;

  if (availableWidth <= 0) {
    return template.previewScale || 0.9;
  }

  var scale = availableWidth / pageWidthPx;

  return Math.min(scale, template.previewScale || 0.9);
}

function applyTemplateCssVars(root, template) {
  setCssVar(root, '--cols', template.cols);
  setCssVar(root, '--rows', template.rows);
  setCssVar(root, '--inner-dia-in', template.innerDia);
  setCssVar(root, '--outer-dia-in', template.outerDia);
  setCssVar(root, '--gap-x-in', template.gapX);
  setCssVar(root, '--gap-y-in', template.gapY);
  setCssVar(root, '--dpi', template.dpi);
  setCssVar(root, '--preview-scale', calculatePreviewScale(root, template));
}

function updatePreviewScale(root, template) {
  setCssVar(root, '--preview-scale', calculatePreviewScale(root, template));
}