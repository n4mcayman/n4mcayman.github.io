(function () {
  "use strict";
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function number(n) { return n == null ? 'Not measured' : Number(n).toLocaleString('en-US'); }
  function delta(a,b,money) {
    if (a == null || b == null) return 'Previous reading unavailable';
    var d = a - b;
    if (Math.abs(d) < .000001) return 'No change';
    return (d > 0 ? '▲ Up ' : '▼ Down ') + (money ? 'CI$' + Math.abs(d).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : number(Math.abs(d)));
  }
  function render(W) {
    var root = document.getElementById('glance');
    if (!root || !W) return null;
    var weeks = (W.fuel || []).filter(function(f) { return f.averages && f.averages.regular; });
    var fuel = weeks[weeks.length-1], jobs = W.jobs, ships = W.ships, courts = W.courts;
    var planning = document.getElementById('ytd-value');
    var planningValue = planning ? planning.textContent.replace(/^\$/, 'CI$') : 'Not measured';
    var court = courts && courts.this && courts.this.lists ? courts.this : courts && courts.last;
    var notices = W.notices && W.notices.items;
    var rows = [
      ['01','Fuel','pump-h',fuel ? 'CI$'+fuel.averages.regular.current.toFixed(2) : 'Not measured',fuel ? delta(fuel.averages.regular.current,fuel.averages.regular.previous,true) : 'No report'],
      ['02','Jobs','work-h',jobs ? number(jobs.open_posts) : 'Not measured','Open posts'],
      ['03','Ships','port-h',ships && ships.this ? number(ships.this.passengers) : 'Not measured','Passengers due this week'],
      ['04','Courts','courts-h',court ? number(court.matters) : 'Not measured',courts && courts.this && courts.this.lists ? 'Matters listed this week' : 'Latest measured week'],
      ['05','Notices','record-h',notices ? number(notices.length) : 'Not measured','Documents in the record'],
      ['06','Planning','build-h',planningValue,'Declared this year'],
      ['07','Ledger','wow-h',document.getElementById('ledger-total') ? document.getElementById('ledger-total').textContent : 'Not measured','Measures in this edition'],
      ['08','Film','reel-h',document.getElementById('film-duration') ? document.getElementById('film-duration').textContent + ' sec' : 'Silent recap','Play on demand'],
      ['09','Weather','weather-h',document.getElementById('weather-hero').textContent,document.getElementById('weather-hero').dataset.index || 'No reading'],
      ['10','Public service','public-service-h',document.getElementById('public-service-hero').textContent,'First snapshot · recorded posts'],
      ['11','Cabinet','cabinet-h',document.getElementById('cabinet-hero').textContent,document.getElementById('cabinet-kind').textContent],
      ['12','Sister Islands','sister-islands-h',document.getElementById('dcb-hero').textContent,document.getElementById('dcb-kind').textContent]
    ];
    var list = element('ol','running-list');
    rows.forEach(function(row) {
      var target = document.getElementById(row[2]);
      if (!target || target.closest('section').hidden) return;
      var li = element('li'), link = element('a','running-link');
      link.href = '#'+row[2];
      if (Number(row[0]) >= 9) li.className = 'm4-index';
      if (row[2] === 'build-h' && planning && planning.hasAttribute('data-value')) {
        var exact = 'Planning: CI$' + number(Number(planning.getAttribute('data-value'))) + ' declared this year';
        link.setAttribute('aria-label', exact); link.setAttribute('title', exact);
      }
      link.appendChild(element('span','running-number',row[0]));
      link.appendChild(element('span','running-name',row[1]));
      link.appendChild(element('span','running-figure',row[3]));
      li.appendChild(link);
      li.appendChild(element('span','running-change',row[4]));
      list.appendChild(li);
    });
    root.replaceChildren(list);
    return list;
  }
  window.Glance = { render:render };
})();
