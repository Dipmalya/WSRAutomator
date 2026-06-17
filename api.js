// WSR Slide Creator - client-side logic
(function () {
	const teamSelect = document.getElementById('teamSelect');
	const appContent = document.getElementById('appContent');
	const selectedTeamEl = document.getElementById('selectedTeam');
	const driTableBody = document.getElementById('driTableBody');
	const membersTableBody = document.getElementById('membersTableBody');
	const generateBtn = document.getElementById('generateBtn');
	const resetBtn = document.getElementById('resetBtn');

	let rawData = [];
	let members = [];
	let initialState = null;

	function loadData() {
		return fetch('sprint_data.json').then(r => r.json()).then(data => {
			rawData = data;
			processMembers();
		});
	}

	function processMembers() {
		const map = new Map();
		rawData.forEach(item => {
			const name = item.Owner && item.Owner._refObjectName ? item.Owner._refObjectName : 'Unassigned';
			const actual = Number(item.TaskActualTotal || 0);
			const remaining = Number(item.TaskRemainingTotal || 0);
			const plan = Number(item.PlanEstimate || 0);
			const totalHours = actual;
			if (!map.has(name)) map.set(name, { name, estimatedHours: 0, storyPoints: 0 });
			const entry = map.get(name);
			entry.estimatedHours += totalHours;
			entry.storyPoints += plan;
		});

		members = Array.from(map.values()).map(m => ({
			name: m.name,
			estimatedHours: Math.round(m.estimatedHours*10)/10,
			storyPoints: m.storyPoints,
			leaveDays: 0,
			leaveDates: [],
			selected: true,
		}));

		// keep a deep copy for reset
		initialState = JSON.parse(JSON.stringify({ members }));
	}

	function renderDRITable() {
		const categories = ['Decision', 'Risk', 'Issues'];
		driTableBody.innerHTML = '';
		categories.forEach(cat => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td class="px-3 py-2">${cat}</td>
				<td class="px-3 py-2"><input data-category="title" class="w-full border rounded px-2 py-1" placeholder="${cat} title"></td>
				<td class="px-3 py-2"><input data-category="owner" class="w-full border rounded px-2 py-1" placeholder="Owner"></td>
				<td class="px-3 py-2"><input data-category="plan" class="w-full border rounded px-2 py-1" placeholder="Mitigation / notes"></td>
			`;
			driTableBody.appendChild(tr);
		});
	}

	function renderMembers() {
		membersTableBody.innerHTML = '';
		members.forEach((m, idx) => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td class="px-2 py-2 text-center"><input type="checkbox" data-idx="${idx}" class="member-select" ${m.selected? 'checked': ''}></td>
				<td class="px-3 py-2">${m.name}</td>
				<td class="px-3 py-2"><input class="w-24 border rounded px-2 py-1 muted" value="${m.estimatedHours}" readonly></td>
				<td class="px-3 py-2"><input class="w-20 border rounded px-2 py-1 muted" value="${m.storyPoints}" readonly></td>
				<td class="px-3 py-2"><input type="number" min="0" data-idx="${idx}" class="w-20 border rounded px-2 py-1 leave-days" value="${m.leaveDays}"></td>
				<td class="px-3 py-2">
					<div class="flex items-center gap-2">
						<input type="date" data-idx="${idx}" class="date-input border rounded px-2 py-1">
						<button data-idx="${idx}" class="add-date bg-indigo-600 text-white px-2 py-1 rounded text-sm">Add</button>
					</div>
					<div class="mt-2 date-list" data-idx="${idx}"></div>
				</td>
				<td class="px-3 py-2"><input class="w-28 border rounded px-2 py-1 muted available-hours" value="${calcAvailable(m)}" readonly></td>
			`;

			membersTableBody.appendChild(tr);
		});

		attachMemberEvents();
		renderAllDateLists();
	}

	function calcAvailable(m) {
		return Math.max(0, Math.round((m.estimatedHours - (Number(m.leaveDays||0) * 8)) * 10)/10);
	}

	function attachMemberEvents() {
		document.querySelectorAll('.member-select').forEach(cb => {
			cb.addEventListener('change', e => {
				const idx = Number(e.target.dataset.idx);
				members[idx].selected = e.target.checked;
			});
		});

		document.querySelectorAll('.leave-days').forEach(input => {
			input.addEventListener('input', e => {
				const idx = Number(e.target.dataset.idx);
				members[idx].leaveDays = Number(e.target.value || 0);
				updateAvailableRow(idx);
			});
		});

		document.querySelectorAll('.add-date').forEach(btn => {
			btn.addEventListener('click', e => {
				const idx = Number(e.target.dataset.idx);
				const row = document.querySelector(`.date-input[data-idx="${idx}"]`);
				const val = row.value;
				if (val) {
					if (!members[idx].leaveDates.includes(val)) members[idx].leaveDates.push(val);
					// sync leaveDays to number of leaveDates
					members[idx].leaveDays = members[idx].leaveDates.length;
					const leaveInput = document.querySelector(`.leave-days[data-idx="${idx}"]`);
					if (leaveInput) leaveInput.value = members[idx].leaveDays;
					renderDateList(idx);
					updateAvailableRow(idx);
				}
			});
		});
	}

	function renderAllDateLists() {
		members.forEach((m, idx) => renderDateList(idx));
	}

	function renderDateList(idx) {
		const container = document.querySelector(`.date-list[data-idx="${idx}"]`);
		container.innerHTML = '';
		members[idx].leaveDates.forEach((d, i) => {
			const chip = document.createElement('div');
			chip.className = 'date-chip';
			chip.innerHTML = `<span>${d}</span><button data-idx="${idx}" data-i="${i}" class="remove-date text-xs text-red-600">✕</button>`;
			container.appendChild(chip);
		});
		container.querySelectorAll('.remove-date').forEach(btn => {
			btn.addEventListener('click', e => {
				const i = Number(e.target.dataset.i);
				const idxx = Number(e.target.dataset.idx);
				members[idxx].leaveDates.splice(i,1);
				// sync leaveDays to number of leaveDates
				members[idxx].leaveDays = members[idxx].leaveDates.length;
				const leaveInput = document.querySelector(`.leave-days[data-idx="${idxx}"]`);
				if (leaveInput) leaveInput.value = members[idxx].leaveDays;
				renderDateList(idxx);
				updateAvailableRow(idxx);
			});
		});
	}

	function updateAvailableRow(idx) {
		const row = membersTableBody.querySelectorAll('tr')[idx];
		const availInput = row.querySelector('.available-hours');
		availInput.value = calcAvailable(members[idx]);
	}

	function init() {
		loadData().then(() => {
			teamSelect.addEventListener('change', onTeamChange);
			generateBtn.addEventListener('click', onGenerate);
			resetBtn.addEventListener('click', onReset);
			// auto show when team selected (single team for now)
			onTeamChange();
		}).catch(err => console.error('Failed to load data', err));
	}

	function onTeamChange() {
		const team = teamSelect.value;
		selectedTeamEl.textContent = team;
		appContent.classList.remove('hidden');
		renderDRITable();
		renderMembers();
	}

	function collectDRIData() {
		const rows = Array.from(driTableBody.querySelectorAll('tr'));
		return rows.map(r => {
			return {
				category: r.children[0].innerText.trim(),
				title: r.querySelector('input[data-category="title"]').value,
				owner: r.querySelector('input[data-category="owner"]').value,
				plan: r.querySelector('input[data-category="plan"]').value,
			};
		});
	}

	function collectSelectedMembers() {
		return members.filter(m => m.selected).map(m => ({
			name: m.name,
			estimatedHours: m.estimatedHours,
			storyPoints: m.storyPoints,
			leaveDays: m.leaveDays,
			leaveDates: m.leaveDates.slice(),
			availableHours: calcAvailable(m),
		}));
	}

	function onGenerate() {
		const dri = collectDRIData();
		const sels = collectSelectedMembers();

		const PptxClass = window.PptxGenJS || window.PPTXGenJS || window.pptxgen || window.pptxgenjs;
		if (!PptxClass) {
			alert('PPTXGenJS library not loaded. Please ensure the CDN is reachable.');
			return;
		}
		const pptx = new PptxClass();
		const slide = pptx.addSlide();
		slide.addText('WSR Slide - ' + (teamSelect.value||''), { x:0.5, y:0.25, fontSize:18, bold:true });

		// DRI table
		const driTable = [ ['Category','Title','Owner','Mitigation Plan'] ];
		dri.forEach(r => driTable.push([r.category, r.title || '', r.owner || '', r.plan || '']));
		slide.addTable(driTable, { x:0.5, y:0.8, w:9, colW:[1.2,3.0,2.0,3.0], fontSize:12, border:{pt:0.5,color:'666666'} });

		// Members table after some vertical offset
		const membersTable = [ ['Name','Estimated Hrs','Story Pts','Leave Days','Leave Dates','Available Hrs'] ];
		sels.forEach(m => membersTable.push([m.name, String(m.estimatedHours), String(m.storyPoints), String(m.leaveDays), (m.leaveDates||[]).join(', '), String(m.availableHours)]));
		slide.addTable(membersTable, { x:0.5, y:3.2, w:9, colW:[2.2,1.2,1.0,1.0,2.2,1.2], fontSize:11, border:{pt:0.5,color:'666666'} });

		// footer/team
		slide.addText(teamSelect.value || '', { x:0.5, y:6.8, fontSize:12, color:'444444' });

		pptx.writeFile({ fileName: `WSR_${(teamSelect.value||'team').replace(/\s+/g,'_')}.pptx` });
	}

	function onReset() {
		if (!initialState) return;
		members = JSON.parse(JSON.stringify(initialState.members));
		renderDRITable();
		renderMembers();
	}

	// start
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();

