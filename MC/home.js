function toggleNav(x) {
    x.classList.toggle("change");
    var sideBar = document.querySelector("#mySidenav");
    var main = document.querySelector("#main");
    sideBar.classList.toggle("menu-width");
    main.classList.toggle("menu-margin");
}