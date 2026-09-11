function toggleBtnDropdown() {
  document.getElementById("mybtnDropdown").classList.toggle("btnshow");
}

// Close the dropdown menu if the user clicks outside of it
window.onclick = function(event) {
  if (!event.target.matches('.btnDropdown')) {
    var dropdowns = document.getElementsByClassName("button-dropdown-content");
    for (var i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.classList.contains('btnshow')) {
        openDropdown.classList.remove('btnshow');
      }
    }
  }
}

function toggleStickerDropdown() {
  document.getElementById("mystickerDropdown").classList.toggle("stcshow");
}

// Close the dropdown menu if the user clicks outside of it
window.onclick = function(event) {
  if (!event.target.matches('.stickerDropdown')) {
    var dropdowns = document.getElementsByClassName("sticker-dropdown-content");
    for (var i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.classList.contains('stcshow')) {
        openDropdown.classList.remove('stcshow');
      }
    }
  }
}