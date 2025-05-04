const menuItems = document.querySelectorAll(".sidebar li");
const sections = document.querySelectorAll(".content-section");

menuItems.forEach(item => {
  item.addEventListener("click", () => {
    const targetId = item.getAttribute("data-target");

    sections.forEach(sec => {
      sec.classList.add("hidden");
    });

    document.getElementById(targetId).classList.remove("hidden");
  });
});

