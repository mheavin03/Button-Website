// 3in round sticker version (3" sticker with 3.451" cut; no inner circle)
// Clean implementation with 2-1-2 layout

(function(){
  'use strict';
  var SHOW_DELETE_CONFIRM = false;
  var USE_OBJECT_URLS = true;
  try{
    if (location.origin === 'null' || (location.protocol !== 'http:' && location.protocol !== 'https:')) {
      USE_OBJECT_URLS = false;
    }
  }catch(_){ USE_OBJECT_URLS = false; }

  var TEMPLATE = {
    cols: 2,
    rows: 3,
    innerDia: 3.5,
    outerDia: 3.5,
    gapX: 0.65,
    gapY: 0.15,
    dpi: 300,
    previewScale: 0.9,
    showInnerRing: false,
    showInnerRingInPdf: false,
    imageFitDiameter: 'outer',
    cutGuideDirection: 'horizontal'
  };

  var LAYOUT = [2, 1, 2];
  var TOTAL_CELLS = 5;

  var root = document.documentElement;

  var COLS = TEMPLATE.cols;
  var ROWS = TEMPLATE.rows;

  applyTemplateCssVars(root, TEMPLATE);

  var pages = [];
  var pagesWrap = document.getElementById('pages');

  function createEmptyState(){
    return Array.from({ length: TOTAL_CELLS }, function(){ 
      return { 
        img: null, 
        fit: 'contain', 
        scale: 1, 
        nx: 0, 
        ny: 0 }; 
      });
  }

  function buildGridForPage(page){
    page.gridEl.innerHTML = '';
    page.cells.length = 0;
    var i = 0;
    for (var r = 0; r < ROWS; r++){
      var colsInRow = LAYOUT[r];
      for (var c = 0; c < colsInRow; c++){
        (function(i, r, c, colsInRow){
          var cell = document.createElement('div'); 
          cell.className = 'cell'; 

          cell.dataset.index = i; 
          cell.tabIndex = 0;
          cell.setAttribute('role', 'button'); 
          cell.setAttribute('aria-label', 'Sticker circle ' + (i+1));

          cell.style.gridRow = (r + 1).toString();
          cell.style.gridColumn = (colsInRow === 1) ? '1 / span 2' : (c + 1).toString();

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
            
            if (!isSupportedImageFile(file)) {
              alert('Use JPG/PNG/WebP.');
              input.value = '';
              input.blur();
              return;
            }

            loadFileWithFallback(
              file,
              USE_OBJECT_URLS,
              function(src){
                return loadImageToCell(page, idx, src);
              }
            ).finally(function(){
              input.value = '';
              input.blur();
            });
          });

          cell.appendChild(input);

          cell.addEventListener('keydown', function(ev) { 
            if (ev.key === 'Enter' || ev.key === ' ') { 
              if (page.state[i].img) { 
                ev.preventDefault(); 
                return; 
              } 
              ev.preventDefault(); 
              input.click(); 
            } 
          });

          img.addEventListener('click', function(ev){ 
            ev.preventDefault(); 
            ev.stopPropagation(); 
          });

          input.addEventListener('click', function(ev){ 
            ev.stopPropagation(); 
          });

          var toolbar = createToolbar();
          
          var tb = toolbar.toolbar;
          var delBtn = toolbar.deleteButton;
          var zoomOutBtn = toolbar.zoomOutButton;
          var zoomInBtn = toolbar.zoomInButton;
          var centerBtn = toolbar.centerButton;

          cell.appendChild(tb);

          tb.addEventListener('mousedown', function(e){
            if (e.target && e.target.tagName === 'BUTTON') {
              e.preventDefault();
            }
            e.stopPropagation();
          });

          var dupBtn = createDuplicateButton();
          cell.appendChild(dupBtn);

          zoomInBtn.addEventListener(
            'click', 
            function(e){ 
              e.stopPropagation(); 
              sharedAdjustZoom(page, i, 1.1, root, TEMPLATE); 
            }
          );

          zoomOutBtn.addEventListener(
            'click', 
            function(e){ 
              e.stopPropagation(); 
              sharedAdjustZoom(page, i, 1/1.1, root, TEMPLATE); 
            }
          );

          centerBtn.addEventListener(
            'click', 
            function(e){ 
              e.stopPropagation(); 
              sharedResetTransform(page, i, root, TEMPLATE); 
            }
          );

          setupImageDrag(
            img,
            page,
            i,
            root,
            TEMPLATE,
            function(page, index, nx, ny){
              sharedSetOffset(page, index, nx, ny, root, TEMPLATE);
            }
          );

          setupImageWheelZoom(
            imgWrap,
            page,
            i,
            function(page, index, factor){
              sharedAdjustZoom(page, index, factor, root, TEMPLATE);
            }
          );

          cell.addEventListener('dragover', function(e){ 
            e.preventDefault(); 
            this.style.outline = '2px solid #77aaff'; 
          });

          cell.addEventListener('dragleave', function(){ 
            this.style.outline = ''; 
          });
          
          cell.addEventListener('drop', function(e){ 
            e.preventDefault(); 
            this.style.outline = ''; 

            var file = e.dataTransfer.files && e.dataTransfer.files[0]; 
            var idx = i; 

            if(!file) return; 

            if (!isSupportedImageFile(file)) {
              alert('Use JPG/PNG/WebP.'); 
              return; 
            } 

            loadFileWithFallback(
              file,
              USE_OBJECT_URLS,
              function(src){
                return loadImageToCell(page, idx, src);
              }
            );
          });

          delBtn.addEventListener('click', function(e){ 
            e.stopPropagation(); 
            clearCell(page, i); 
          });

          dupBtn.addEventListener('click', function(e){ 
            e.stopPropagation(); 
            duplicateToNext(page, i); 
          });

          page.gridEl.appendChild(cell);
          page.cells.push(
            { 
              cell: cell, 
              empty: empty, 
              imgWrap: imgWrap, 
              img: img, 
              fitBox: 
              fitBox, 
              tb: tb, 
              input: input 
            });

          setFitBoxSize(fitBox, root, TEMPLATE);

          updateTransformVars(page, i, root, TEMPLATE);
        })(i, r, c, colsInRow);
        i++;
      }
    }
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

  var page0 = createPage();
  document.getElementById('addPage')
    .addEventListener(
      'click', 
      function(){ 
        createPage(); 
      }
    );

  function deletePage(page){
    sharedDeletePage(
      page,
      pages,
      pagesWrap,
      createPage
    );
  }

  var bulkInputEl = document.getElementById('bulkInput');
  bulkInputEl.addEventListener('change', function(e){
    var files = Array.prototype.slice.call(e.target.files || []).filter(function(f){ return isSupportedImageFile(f); });
    if(!files.length) return;
    bulkAddFilesAllPages(files).finally(function(){ 
      try{ 
        e.target.value = ''; 
      } catch(_){ } 
    });
  });

  function planPagesNeeded(currentEmpty, filesCount){ 
    if(filesCount <= currentEmpty) 
      return 0; 
    var perPage = TOTAL_CELLS; 
    return Math.ceil((filesCount - currentEmpty) / perPage); 
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
      function(page, index) {
        updateTransformVars(page, index, root, TEMPLATE);
      }
    );
  }

  function clearCell(page, index){ 
    sharedClearCell(page, index, function(page, index) {
      updateTransformVars(page, index, root, TEMPLATE);
    });
  }

  function loadImageToCell(page, index, src){ 
    return sharedLoadImageToCell(page, index, src, function(page, index) {
      updateTransformVars(page, index, root, TEMPLATE);
    });
  }

  document.getElementById('clearAll').addEventListener('click', function(){ pages.forEach(function(pg){ for(var i=0;i<pg.state.length;i++){ clearCell(pg, i); } }); });

  document.getElementById('exportPDF').addEventListener('click', function(){
    var proposed = sharedGetExportFilename(
      'sticker-3in-2-1-2.pdf',
      sanitizeFilename
    );
    sharedShowFilenamePrompt(
      proposed,
      sanitizeFilename
    ).then(function(chosen){
      if(!chosen) return;
      var filename = chosen;
      var g = sharedComputeExportGeometry(root, TEMPLATE);
      var pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'pt', format: [8.5*72, 11*72] });
      
      async function renderOnePage(pageIndex){
        var page = pages[pageIndex];
        var canvas = document.createElement('canvas'); canvas.width = g.pageWpx; canvas.height = g.pageHpx;
        var ctx = canvas.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, g.pageWpx, g.pageHpx);
        var k = 0;
        for (var r = 0; r < ROWS; r++){
          var colsInRow = LAYOUT[r];
          for (var c = 0; c < colsInRow; c++){
            var x, cx; var y = g.marginY + r*(g.outerDiaPx + g.gapYPx);
            if (colsInRow === 1){ cx = g.marginX + g.gridW/2; x = cx - g.outerDiaPx/2; }
            else { x = g.marginX + c*(g.outerDiaPx + g.gapXPx); cx = x + g.outerDiaPx/2; }
            var cy = y + g.outerDiaPx/2; var outerR = g.outerDiaPx/2;
            var cellState = page.state[k];

            var cellGeometry = {
              x: x,
              y: y,
              cx: cx,
              cy: cy,
              outerR: outerR,
              innerR: 0
            };

            await new Promise(function(resolve){
              
              sharedDrawPdfCell(
                ctx,
                cellState || { img: null },
                cellGeometry,
                g,
                TEMPLATE,
                loadImage,
                function(){
                  resolve();
                }
              );
            });
            k++;
          }
        }
        drawPdfCutGuides(ctx, g, TEMPLATE);
        
        var imgData = canvas.toDataURL('image/jpeg', 0.95);
        if(pageIndex > 0) pdf.addPage([8.5*72, 11*72], 'p');
        pdf.addImage(imgData, 'JPEG', 0, 0, 8.5*72, 11*72);
        if(pageIndex+1 < pages.length){
          await renderOnePage(pageIndex+1);
        } else {
          pdf.save(filename);
        }
      }
      if(pages.length === 0){ createPage(); }
      renderOnePage(0).catch(function(err){
        console.error(err);
        alert('Failed to export PDF. Please try again.');
      });
    });
  });

})();

