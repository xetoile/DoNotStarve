const calendar = new DoNotStarveCalendar();
const seasonFA = function(season) {
  let icon;
  switch (season) {
    case 'winter':
      icon = 'skiing-nordic';
      break;
    case 'summer':
      icon = 'umbrella-beach';
      break;
    case 'spring':
      icon = 'cloud-showers-heavy';
      break;
    case 'autumn':
      icon = 'cloud-sun';
      break;
  }
  return {
    fas: true,
    ['fa-' + icon]: true
  };
};
window.vm = new Vue({
  el: "#vueApp",
  data: {
    calendar
  },
  computed: {
    currentSeasonFA: function() {
      return seasonFA(this.calendar.season.current.label);
    },
    nextSeasonFA: function() {
      return seasonFA(this.calendar.season.next.label);
    }
  }
});