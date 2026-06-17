// WSR Slide Creator - client-side logic
(function () {
    let pptObj = {};
	const teamSelect = document.getElementById('teamSelect');
	const appContent = document.getElementById('appContent');
	const selectedTeamEl = document.getElementById('selectedTeam');
	const driTableBody = document.getElementById('driTableBody');
	const membersTableBody = document.getElementById('membersTableBody');
	const generateBtn = document.getElementById('generateBtn');
	const resetBtn = document.getElementById('resetBtn');
	const teamSummarySection = document.getElementById('teamSummary');
	const summaryTeamTitle = document.getElementById('summaryTeamTitle');
	const summarySprintName = document.getElementById('summarySprintName');
	const summaryHours = document.getElementById('summaryHours');
	const summaryPoints = document.getElementById('summaryPoints');
	const summaryAcceptedPoints = document.getElementById('summaryAcceptedPoints');
	const summaryMemberCount = document.getElementById('summaryMemberCount');

	let rawData = [];
	let members = [];
	let initialState = null;

    function loadTeamData() {
        return fetch('team_data.json').then(r => r.json()).then(data => {
            data.forEach(team => {
                if (team.teamName === teamSelect.value) {
                    pptObj.teamName = team.teamName;
                    pptObj.sprintName = getSprintName();
                    pptObj.accLead = team.AccLead;
                    pptObj.clientLead = team.ClientLead;
                    pptObj.clientPO = team.ClientPO;
                    pptObj.accDevCounts = team.AccDevCounts;
                }
            });
        });
    }

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
			const plan = Number(item.PlanEstimate || 0);
			if (!map.has(name)) map.set(name, { name, estimatedHours: 0, storyPoints: 0 });
			const entry = map.get(name);
			entry.estimatedHours += actual;
			entry.storyPoints += plan;
		});

        pptObj.teamName = teamSelect.value || 'Team';
        pptObj.sprintName = getSprintName();

        pptObj.plannedVelocity = rawData.reduce((sum, item) => sum + Number(item.PlanEstimate || 0), 0);
        pptObj.acceptedVelocity = rawData.reduce((sum, item) => sum + ((item.ScheduleState === 'Accepted') ? Number(item.PlanEstimate || 0) : 0), 0);
        pptObj.velRatio = pptObj.plannedVelocity ? (pptObj.acceptedVelocity / pptObj.plannedVelocity * 100).toFixed(2) : 0.0;
        pptObj.currSprintUserStoryCount = rawData.filter(item => item._type === 'HierarchicalRequirement').length;
        pptObj.currSprintDefectCount = rawData.filter(item => item._type === 'Defect').length;
        pptObj.currSprintUserStoryAcceptedCount = rawData.filter(item => item._type === 'HierarchicalRequirement' && item.ScheduleState === 'Accepted').length;
        pptObj.currSprintDefectAcceptedCount = rawData.filter(item => item._type === 'Defect' && item.ScheduleState === 'Accepted').length;

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

	function getSprintName() {
		const itemWithIteration = rawData.find(item => item.Iteration && item.Iteration._refObjectName);
		return itemWithIteration ? itemWithIteration.Iteration._refObjectName : 'Unknown Sprint';
	}

	function updateSummary(team) {
		const totalHours = members.reduce((sum, m) => sum + m.estimatedHours, 0);
		const totalPoints = members.reduce((sum, m) => sum + m.storyPoints, 0);
		const acceptedPoints = rawData.reduce((sum, item) => {
			return sum + ((item.ScheduleState === 'Accepted') ? Number(item.PlanEstimate || 0) : 0);
		}, 0);
		const memberCount = members.length;
		const sprintName = getSprintName();

		summaryTeamTitle.textContent = `${team} - ${sprintName}`;
		summaryHours.textContent = Math.round(totalHours * 10) / 10;
		summaryPoints.textContent = totalPoints;
		summaryAcceptedPoints.textContent = acceptedPoints;
		summaryMemberCount.textContent = memberCount;
		teamSummarySection.classList.remove('hidden');
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
        loadTeamData();
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
		updateSummary(team);
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

	function formatCurrentDate() {
		const now = new Date();
		const day = String(now.getDate()).padStart(2, '0');
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const year = now.getFullYear();
		return `${day}/${month}/${year}`;
	}

	async function generatePptFromTemplate(teamName) {
		const templateUrl = 'WSR-Template.pptx';
		const formattedDate = formatCurrentDate();
		const replacements = [
			{ find: '$TEAM_NAME', replace: teamName },
			{ find: '$DATE', replace: formattedDate },
            { find: '$ACC_LEAD', replace: pptObj.accLead },
            { find: '$CLIENT_LEAD', replace: pptObj.clientLead },
            { find: '$CLIENT_PO', replace: pptObj.clientPO },
            { find: '$ACC_DEV_COUNT', replace: pptObj.accDevCounts },
            { find: '$N_PV', replace: pptObj.plannedVelocity },
            { find: '$N_AV', replace: pptObj.acceptedVelocity },
            { find: '$N_VR', replace: pptObj.velRatio },
            { find: '$N_US', replace: pptObj.currSprintUserStoryCount },
            { find: '$N_DF', replace: pptObj.currSprintDefectCount },
            { find: '$N_DUS', replace: pptObj.currSprintUserStoryAcceptedCount },
            { find: '$N_FDF', replace: pptObj.currSprintDefectAcceptedCount },
		];

		try {
			const response = await fetch(templateUrl);
			if (!response.ok) throw new Error(`Template fetch failed: ${response.status}`);
			const arrayBuffer = await response.arrayBuffer();
			const zip = await JSZip.loadAsync(arrayBuffer);

			const xmlFiles = Object.values(zip.files).filter(file => !file.dir && file.name.endsWith('.xml'));
			await Promise.all(xmlFiles.map(async file => {
				const content = await file.async('string');
				let updated = content;
				replacements.forEach(rep => {
					updated = updated.split(rep.find).join(rep.replace);
				});
				if (updated !== content) zip.file(file.name, updated);
			}));

			const blob = await zip.generateAsync({ type: 'blob' });
			const fileName = `WSR_${teamName.replace(/\s+/g, '_')}_${formattedDate.replace(/\//g, '-')}.pptx`;
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Template generation failed:', err);
			alert(`Unable to create PPT from template: ${err.message}`);
		}
	}

	function onGenerate() {
		const team = teamSelect.value || 'Team';
		generatePptFromTemplate(team);
	}

	function onReset() {
		if (!initialState) return;
		members = JSON.parse(JSON.stringify(initialState.members));
		renderDRITable();
		renderMembers();
		updateSummary(teamSelect.value);
	}

	// start
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();

