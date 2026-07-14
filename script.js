document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');
});

const weeklySchedule = {
  1: { name: "Board Game Night", time: "5:00 PM · Free", copy: "Bring your favorite board game or borrow one of ours. All ages and experience levels welcome." },
  2: { name: "Nexus Night", time: "6:00 PM · $8 entry", copy: "Pull up a chair, bring a deck, and settle in. Nexus Night runs every week for Riftbound and Magic players looking for a real table and real competition." },
  4: { name: "Commander Night", time: "5:00 PM · Free", copy: "Grab your deck and call your crew. All planeswalkers and experience levels welcome to the table." },
  5: { name: "Pauper Night", time: "6:00 PM · Free", copy: "Budget-friendly Magic at its finest. Commons and uncommons only, skill still required." }
};

function loadTonightEvent() {
  const nameEl = document.getElementById('tonightName');
  const timeEl = document.getElementById('tonightTime');
  const copyEl = document.getElementById('tonightCopy');
  const labelEl = document.getElementById('tonightLabel');

  if (!nameEl) return;

  const today = new Date().getDay();
  const event = weeklySchedule[today];

  if (event) {
    labelEl.textContent = "Tonight";
    nameEl.textContent = event.name;
    timeEl.textContent = event.time;
    copyEl.textContent = event.copy;
  } else {
    labelEl.textContent = "This Week";
    nameEl.textContent = "Nothing scheduled tonight";
    timeEl.textContent = "";
    copyEl.textContent = "But there's always something on the calendar. Check out our full weekly lineup and upcoming special events.";
  }
}

loadTonightEvent();