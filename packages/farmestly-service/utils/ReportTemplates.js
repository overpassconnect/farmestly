// utils/ReportTemplates.js

// Paste your full base64 string here
// utils/ReportTemplates.js

const { LOGO_BASE64 } = require('../constants');
function escapeHtml(str) {
	if (!str) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
	if (!dateStr) return 'N/A';
	return new Date(dateStr).toLocaleDateString('en-US', {
		year: 'numeric', month: 'short', day: 'numeric'
	});
}

function formatDuration(ms) {
    if (!ms && ms !== 0) return 'N/A';
    if (ms < 0) return 'N/A';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return '<1m';
}

// Compute duration in milliseconds from a record.
// Prefer `elapsedTime` when available but try to detect whether it's seconds or milliseconds.
function getRecordDurationMs(r) {
    if (r && typeof r.elapsedTime === 'number' && r.elapsedTime > 0) {
        // If elapsedTime is small (< 10000), treat as seconds; otherwise treat as ms.
        if (r.elapsedTime < 10000) {
            return r.elapsedTime * 1000; // seconds -> ms
        }
        return r.elapsedTime; // assume ms
    }

    if (r && r.startTime && r.endTime) {
        try {
            const start = new Date(r.startTime);
            const end = new Date(r.endTime);
            const diff = end - start;
            if (!isNaN(diff)) return diff;
        } catch (e) {
            // fallthrough
        }
    }

    return null;
}

function capitalizeFirst(str) {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1);
}

const colors = {
	PRIMARY: '#42210B',
	SECONDARY: '#E37F1B',
	SECONDARY_LIGHT: '#fbf2ec',
	PRIMARY_LIGHT: '#A09085'
};

const baseStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;500;700&display=swap');

    /* very compact page margins for PDF */
    @page { margin: 6mm 5mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
        font-family: 'Geologica', sans-serif; 
        color: ${colors.PRIMARY}; 
        line-height: 1.18; 
        font-size: 11px;
        /* tight inner padding while leaving room for fixed footer */
        padding: 6px 8px 44px 8px;
    }
    
    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid ${colors.PRIMARY};
    }
    .logo {
        height: 18px;
        width: auto;
        opacity: 0.85;
    }
    .header-info {
        text-align: right;
    }
    .header-info h1 { 
        font-size: 16px; 
        font-weight: 700;
        color: ${colors.PRIMARY}; 
        margin-bottom: 2px; 
    }
    .header-info .meta { 
        font-size: 10px; 
        font-weight: 400;
        color: ${colors.PRIMARY_LIGHT}; 
    }
    
    .section { 
        margin-bottom: 12px; 
        page-break-inside: avoid; 
    }
    
    table { 
        width: 100%; 
        border-collapse: collapse; 
        font-size: 9px; 
    }
    th { 
        background: transparent; 
        color: ${colors.PRIMARY};
        padding: 6px 6px; 
        text-align: left; 
        font-weight: 600; 
    }
    td { 
        padding: 5px 6px; 
        border-bottom: 1px solid ${colors.PRIMARY_LIGHT}; 
        color: ${colors.PRIMARY}; 
    }
    tr:nth-child(even) { 
        background: ${colors.SECONDARY_LIGHT}; 
    }
    
    .group-header { 
        border-left: 3px solid ${colors.SECONDARY};
        color: ${colors.SECONDARY};
        padding: 6px 10px; 
        font-weight: 700; 
        font-size: 12px;
        margin-top: 10px; 
        margin-bottom: 8px; 
    }
    
    .no-data { 
        text-align: center; 
        padding: 16px; 
        color: ${colors.PRIMARY_LIGHT};
        background: ${colors.SECONDARY_LIGHT};
        font-weight: 500;
        font-size: 10px;
    }
    
    /* Footer fixed at bottom of each page when printing via Puppeteer */
    .footer {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 6px;
        height: 34px;
        padding-top: 6px;
        border-top: 1px solid ${colors.PRIMARY_LIGHT};
        text-align: center;
        font-size: 8px;
        color: ${colors.PRIMARY_LIGHT};
        background: transparent;
    }

    /* ensure sections don't overlap the fixed footer */
    .section { 
        margin-bottom: 16px; 
        page-break-inside: avoid; 
    }
`;

function generateHeader(farmName, dateRange, totalRecords) {
	const dateRangeText = {
		'all': 'All Time',
		'month': 'Last Month',
		'quarter': 'Last Quarter',
		'year': 'Last Year',
		'custom': 'Custom Range'
	}[dateRange] || dateRange;

	return `
        <div class="header-row">
            <img src="${LOGO_BASE64}" alt="Farmestly" class="logo" />
            <div class="header-info">
                <h1>${escapeHtml(farmName)} Farm Report</h1>
                <div class="meta">
                    ${formatDate(new Date())} • ${dateRangeText} • ${totalRecords} records
                </div>
            </div>
        </div>
    `;
}

function generateJobTable(records, maps) {
	if (!records || records.length === 0) {
		return '<div class="no-data">No records found</div>';
	}

	const rows = records.map(r => `
        <tr>
            <td>${formatDate(r.startTime)}</td>
            <td>${capitalizeFirst(escapeHtml(r.jobType))}</td>
            <td>${escapeHtml(maps.fieldMap[r.fieldId] || 'Unknown')}</td>
            <td>${escapeHtml(r.machineName || maps.machineMap[r.machine] || '-')}</td>
            <td>${formatDuration(getRecordDurationMs(r))}</td>
            <td>${escapeHtml(r.notes || '-')}</td>
        </tr>
    `).join('');

	return `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Job Type</th>
                    <th>Field</th>
                    <th>Machine</th>
                    <th>Duration</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function generateGroupedReport(records, groupKey, groupMap, maps) {
	const groups = {};

	records.forEach(r => {
		const rawValue = r[groupKey];
		let label;

        // Prefer jobTitle when grouping by jobType so custom-named jobs are grouped by name
        if (groupKey === 'jobType' && r.jobTitle) {
            label = r.jobTitle;
        } else if (!rawValue) {
			// No value - use "No Machine", "No Field", etc.
			label = 'No ' + capitalizeFirst(groupKey.replace('Id', ''));
		} else if (groupMap && groupMap[rawValue]) {
			// Have a mapping (for IDs like fieldId -> field name)
			label = groupMap[rawValue];
		} else if (r[groupKey + 'Name']) {
			// Have a Name field (e.g., machineName)
			label = r[groupKey + 'Name'];
		} else {
			// Use raw value (for job types: 'sow', 'harvest', 'custom')
			label = capitalizeFirst(rawValue);
		}

		if (!groups[label]) groups[label] = [];
		groups[label].push(r);
	});

	return Object.entries(groups)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([label, recs]) => `
            <div class="section">
                <div class="group-header">${escapeHtml(label)} (${recs.length} jobs)</div>
                ${generateJobTable(recs, maps)}
            </div>
        `).join('');
}

function generateReportHtml(data) {
	const { reportType, dateRange, farmName, jobRecords, fieldMap, machineMap, attachmentMap, toolMap } = data;
	const maps = { fieldMap, machineMap, attachmentMap, toolMap };

	let content;
	switch (reportType) {
		case 'field':
			content = generateGroupedReport(jobRecords, 'fieldId', fieldMap, maps);
			break;
		case 'machine':
			content = generateGroupedReport(jobRecords, 'machine', machineMap, maps);
			break;
		case 'job_type':
			content = generateGroupedReport(jobRecords, 'jobType', {}, maps);
			break;
		case 'attachment':
			content = generateGroupedReport(jobRecords, 'attachment', attachmentMap, maps);
			break;
		case 'tool':
			content = generateGroupedReport(jobRecords, 'tool', toolMap, maps);
			break;
		default:
			content = `<div class="section">${generateJobTable(jobRecords, maps)}</div>`;
	}

	return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${baseStyles}</style>
        </head>
        <body>
            ${generateHeader(farmName, dateRange, jobRecords.length)}
            ${content}
            <div class="footer">
                Generated by Farmestly • ${new Date().getFullYear()}
            </div>
        </body>
        </html>
    `;
}

module.exports = { generateReportHtml };