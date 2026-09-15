// main-3in.js - 3 inch button version
// This is a copy of main.js with 3"/3.5" as the default sizes

(function(){
  'use strict';
  // PDF export styling flags
  var SHOW_DELETE_CONFIRM = false;
  var USE_OBJECT_URLS = true;
  try {
    if (location.origin === 'null' || (location.protocol !== 'http:' && location.protocol !== 'https:')) {
      USE_OBJECT_URLS = false;
      console.log('[env] forcing DataURL mode due to origin/protocol', { origin: location.origin, protocol: location.protocol });
    }
  } catch(e) { USE_OBJECT_URLS = false; }
  
  var TEMPLATE = {
    cols: 2,
    rows: 3,
    innerDia: 3.0,
    outerDia: 3.5,
    gapX: 0.65,
    gapY: 0.10,
    dpi: 300,
    previewScale: 0.9,
    showInnerRing: true,
    showInnerRingInPdf: false,
    imageFitDiameter: 'inner',
    cutGuideDirection: 'vertical'
  };

  var root = document.documentElement;

  var DEFAULT_TEMPLATE = Object.assign({}, TEMPLATE);

  function loadTemplateSettingsIntoPanel() {

    document.getElementById('settingInnerDia').value =
      TEMPLATE.innerDia;

    document.getElementById('settingOuterDia').value =
      TEMPLATE.outerDia;

    document.getElementById('settingGapX').value =
      TEMPLATE.gapX;

    document.getElementById('settingGapY').value =
      TEMPLATE.gapY;

    document.getElementById('settingPreviewScale').value =
      TEMPLATE.previewScale;

    document.getElementById('settingImageFit').value =
      TEMPLATE.imageFitDiameter;

    document.getElementById('settingCutGuide').value =
      TEMPLATE.cutGuideDirection;
  }

  window.applyTemplateSettings = function() {
    var innerDia = parseFloat(
      document.getElementById('settingInnerDia').value
    ); 
    
    var outerDia = parseFloat(
      document.getElementById('settingOuterDia').value
    );

    var gapX = parseFloat(
      document.getElementById('settingGapX').value
    );

    var gapY = parseFloat(
      document.getElementById('settingGapY').value
    );

    var previewScale = parseFloat(
      document.getElementById('settingPreviewScale').value
    );

    if (!Number.isFinite(innerDia) ||
        !Number.isFinite(outerDia) ||
        !Number.isFinite(gapX) ||
        !Number.isFinite(gapY) ||
        !Number.isFinite(previewScale)) {
      alert('Please enter valid numbers.');
      return;
    }

    TEMPLATE.innerDia = innerDia;
    TEMPLATE.outerDia = outerDia;
    TEMPLATE.gapX = gapX;
    TEMPLATE.gapY = gapY;
    TEMPLATE.previewScale = previewScale;
    TEMPLATE.imageFitDiameter =
      document.getElementById('settingImageFit').value;
    TEMPLATE.cutGuideDirection =
      document.getElementById('settingCutGuide').value;

    updateExistingTemplateLayout();
  }

  window.resetTemplateSettings = function () {
    TEMPLATE.outerDia = DEFAULT_TEMPLATE.outerDia;
    TEMPLATE.innerDia = DEFAULT_TEMPLATE.innerDia;
    TEMPLATE.gapX = DEFAULT_TEMPLATE.gapX;
    TEMPLATE.gapY = DEFAULT_TEMPLATE.gapY;
    TEMPLATE.previewScale = DEFAULT_TEMPLATE.previewScale;
    TEMPLATE.imageFitDiameter =
      DEFAULT_TEMPLATE.imageFitDiameter;
    TEMPLATE.cutGuideDirection =
      DEFAULT_TEMPLATE.cutGuideDirection;

    applyTemplateCssVars(root, TEMPLATE);
    loadTemplateSettingsIntoPanel();
    updateExistingTemplateLayout();
  }

  function updateExistingTemplateLayout() {
      applyTemplateCssVars(root, TEMPLATE);

      pages.forEach(function(page) {
          page.cells.forEach(function(item) {
              item.cell.style.width = '';
              item.cell.style.height = '';

              if (item.fitBox) {
                  setFitBoxSize(item.fitBox, root, TEMPLATE);
              }
          });

          for (var i = 0; i < page.state.length; i++) {
              updateTransformVars(page, i, root, TEMPLATE);
          }
      });
  }

  document.getElementById('settingInnerDia').addEventListener('input', applyTemplateSettings);
  document.getElementById('settingOuterDia').addEventListener('input', applyTemplateSettings);
  document.getElementById('settingGapX').addEventListener('input', applyTemplateSettings);
  document.getElementById('settingGapY').addEventListener('input', applyTemplateSettings);
  document.getElementById('settingPreviewScale').addEventListener('input', applyTemplateSettings);

  document.getElementById('settingImageFit').addEventListener('change', applyTemplateSettings);
  document.getElementById('settingCutGuide').addEventListener('change', applyTemplateSettings);

  document.getElementById('resetTemplateSettings')
    .addEventListener('click', function() {
      resetTemplateSettings();
    });


  var COLS = TEMPLATE.cols;
  var ROWS = TEMPLATE.rows;

  applyTemplateCssVars(root, TEMPLATE);

  var pages = [];
  var pagesWrap = document.getElementById('pages');

  function createEmptyState(){
    return sharedCreateEmptyState(COLS, ROWS);
  }

  function createPage(){
    return sharedCreatePage(
      pages,
      pagesWrap,
      createEmptyState,
      buildGridForPage,
      deletePage,
      SHOW_DELETE_CONFIRM
    );
  }

  function buildGridForPage(page){
    page.gridEl.innerHTML = '';
    page.cells.length = 0;
    for(var i=0; i<page.state.length; i++){
      (function(i){
        var elements = createCellElements();

        var cell = elements.cell;
        var empty = elements.empty;
        var imgWrap = elements.imgWrap;
        var fitBox = elements.fitBox;
        var img = elements.img;

        cell.dataset.index = i;
        cell.tabIndex = 0;
        cell.setAttribute('role', 'button');
        cell.setAttribute('aria-label', 'Image circle ' + (i+1));

        addRings(cell, TEMPLATE);

        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.className = 'file-overlay';
        input.addEventListener('change', function(e){
          var file = e.target.files && e.target.files[0];
          var idx = i;

          if(!file) { 
            input.blur(); 
            return; 
          }

          if(!isSupportedImageFile(file)) { 
            alert('Use JPG/PNG/WebP.'); 
            input.value=''; 
            input.blur(); 
            return; 
          }

          loadFileWithFallback(
            file,
            USE_OBJECT_URLS,
            function(src) {
              return loadImageToCell(page, idx, src);
            }
          ).finally(function() {
            input.value = '';
            input.blur();
          });

        });
        cell.appendChild(input);
        cell.addEventListener('keydown', function(ev){
          if (ev.key === 'Enter' || ev.key === ' ') {
            if (page.state[i].img) { ev.preventDefault(); return; }
            ev.preventDefault();
            input.click();
          }
        });
        input.addEventListener('click', function(ev){ ev.stopPropagation(); });
        img.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); });
        
        var toolbar = createToolbar();

        var tb = toolbar.toolbar;
        var delBtn = toolbar.deleteButton;
        var zoomInBtn = toolbar.zoomInButton;
        var centerBtn = toolbar.centerButton;
        var zoomOutBtn = toolbar.zoomOutButton;

        cell.appendChild(tb);

        tb.addEventListener('mousedown', 
          function(e){ 
            if (e.target && e.target.tagName === 'BUTTON') e.preventDefault(); 
            e.stopPropagation(); 
          });
        
        var dupBtn = createDuplicateButton();
        cell.appendChild(dupBtn);

        zoomInBtn.addEventListener('click', function(e){ e.stopPropagation(); adjustZoom(page, i, 1.1); });
        zoomOutBtn.addEventListener('click', function(e){ e.stopPropagation(); adjustZoom(page, i, 1/1.1); });
        centerBtn.addEventListener('click', function(e){ e.stopPropagation(); resetTransform(page, i); });

        setupImageDrag(
          img,
          page,
          i,
          root,
          TEMPLATE,
          setOffset
        );

        setupImageWheelZoom(
          imgWrap,
          page,
          i,
          adjustZoom
        );

        cell.addEventListener('dragover', function(e){ e.preventDefault(); this.style.outline = '2px solid #77aaff'; });
        cell.addEventListener('dragleave', function(){ this.style.outline = ''; });
        cell.addEventListener('drop', function(e){
          e.preventDefault(); this.style.outline = '';
          var file = e.dataTransfer.files && e.dataTransfer.files[0];
          var idx = i;

          if(!file) 
            return;

          if(!isSupportedImageFile(file)) { 
            alert('Use JPG/PNG/WebP.'); 
            return; 
          }

          loadFileWithFallback(
            file,
            USE_OBJECT_URLS,
            function(src) {
              return loadImageToCell(page, idx, src);
            }
          ).finally(function() {
            input.value = '';
            input.blur();
          });
        });
        delBtn.addEventListener('click', function(e){ e.stopPropagation(); clearCell(page, i); });
        dupBtn.addEventListener('click', function(e){ e.stopPropagation(); duplicateToNext(page, i); });
        page.gridEl.appendChild(cell);
        page.cells.push({ cell: cell, empty: empty, imgWrap: imgWrap, img: img, fitBox: fitBox, tb: tb, input: input });

        setFitBoxSize(fitBox, TEMPLATE);

        try{ applyTransformVars(page, i); }catch(_){ }
      })(i);
    }
  }

  var page0 = createPage();
  document.getElementById('addPage').addEventListener('click', function(){ createPage(); });
  
  function deletePage(page){
    sharedDeletePage(
      page,
      pages,
      pagesWrap,
      createPage
    )
  }
  var bulkInputEl = document.getElementById('bulkInput');
  bulkInputEl.addEventListener('change', function(e){
    var files = Array.prototype.slice.call(
      e.target.files || []
    ).filter(isSupportedImageFile);
    
    if(!files.length) return;
    
    bulkAddFilesAllPages(files).finally(function(){ 
      try { e.target.value=''; } catch(_){} 
    });
  });
  
  function planPagesNeeded(currentEmpty, filesCount){
    return sharedPlanPagesNeeded(
      currentEmpty,
      filesCount,
      COLS,
      ROWS
    );
  }

  function ensurePagesForCount(filesCount){
    return sharedEnsurePagesForCount(
      filesCount,
      pages,
      sharedCountEmptySlots,
      planPagesNeeded,
      createPage
    );
  }

  function bulkAddFilesAllPages(files){
    return sharedBulkAddFilesAllPages(
      files,
      pages,
      ensurePagesForCount,
      loadFileWithFallback,
      USE_OBJECT_URLS,
      loadImageToCell
    );
  }

  function findNextEmptySlot(startPage, startIdx){
    return sharedFindNextEmptySlot(
      pages,
      startPage,
      startIdx,
      createPage
    );
  }

  function duplicateToNext(page, index){
    sharedDuplicateToNext(
      page,
      index,
      findNextEmptySlot,
      loadImageToCell,
      applyTransformVars
    );
  }
  
  function clearCell(page, index){
    sharedClearCell(
      page,
      index,
      applyTransformVars
    );
  }
  
  function loadImageToCell(page, index, src){
    return sharedLoadImageToCell(
      page,
      index,
      src,
      applyTransformVars
    );
  }

  document.getElementById('clearAll').addEventListener('click', function(){
    pages.forEach(function(pg){ for(var i=0;i<pg.state.length;i++){ clearCell(pg, i); } });
  });

  document.getElementById('exportPDF').addEventListener('click', function(){
    var proposed = sharedGetExportFilename(
      'circle-template-2x3-3in.pdf',
      sanitizeFilename
    );

    sharedShowFilenamePrompt(
      proposed,
      sanitizeFilename
    ).then(function(chosen){
      if(!chosen) 
        return;

      var filename = sanitizeFilename(chosen);

      var g = sharedComputeExportGeometry(root, TEMPLATE);

      var pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'pt', format: [8.5*72, 11*72] });
      function renderOnePage(pageIndex){
      var page = pages[pageIndex];

      var pdfCanvas = sharedCreatePdfCanvas(g);
      var canvas = pdfCanvas.canvas;
      var ctx = pdfCanvas.ctx;

      function drawCell(r, c){
        if(r >= ROWS){
          drawPdfCutGuides(ctx, g, TEMPLATE);

          sharedFinishPdfPage(
            pdf,
            canvas,
            pageIndex,
            pages.length,
            filename,
            function() {
              renderOnePage(pageIndex + 1);
            }
          );
          return;
        }

        var i = r*COLS + c;

        var cellGeometry = getCellGeometry(g, r, c);

        var cellState = page.state[i];
        
        sharedDrawPdfCell(
          ctx,
          cellState,
          cellGeometry,
          g,
          TEMPLATE,
          loadImage,
          function() {
            if (c + 1 < COLS) {
              drawCell(r, c + 1);
            } else {
              drawCell(r + 1, 0);
            }
          }
        );
        
      }
      drawCell(0,0);
    }
      if(pages.length === 0){ createPage(); }
      renderOnePage(0);
    });
  });
  
  function applyTransformVars(page, index){
    updateTransformVars(page, index, root, TEMPLATE);
  }

  function adjustZoom(page, index, factor){
    sharedAdjustZoom(page, index, factor, root, TEMPLATE);
  }

  function setOffset(page, index, nx, ny){
    sharedSetOffset(page, index, nx, ny, root, TEMPLATE);
  }
  
  function resetTransform(page, index){
    sharedResetTransform(page, index, root, TEMPLATE);
  }

  window.toggleSettings = function() {
    var instructions = document.querySelector("#instructions");
    instructions.classList.toggle("hidden");

    var settings = document.querySelector("#settings");
    settings.classList.toggle("hidden");

    loadTemplateSettingsIntoPanel();
  }

})();
