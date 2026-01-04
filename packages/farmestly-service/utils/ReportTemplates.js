// utils/ReportTemplates.js

const { LOGO_BASE64 } = require('../constants');
const { DEFAULT_LOCALE } = require('./locale');

function escapeHtml(str) {
	if (!str) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Format a date using the user's locale.
 * @param {string|Date} dateStr - Date to format
 * @param {string} locale - BCP 47 locale tag
 * @returns {string} - Formatted date string
 */
function formatDate(dateStr, locale = DEFAULT_LOCALE) {
	if (!dateStr) return 'N/A';
	return new Date(dateStr).toLocaleDateString(locale, {
		year: 'numeric', month: 'short', day: 'numeric'
	});
}

/**
 * Format a number using the user's locale.
 * @param {number} num - Number to format
 * @param {string} locale - BCP 47 locale tag
 * @param {object} options - Intl.NumberFormat options
 * @returns {string} - Formatted number string
 */
function formatNumber(num, locale = DEFAULT_LOCALE, options = {}) {
	if (num == null || isNaN(num)) return 'N/A';
	return new Intl.NumberFormat(locale, options).format(num);
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

    if (r && r.startedAt && r.endedAt) {
        try {
            const start = new Date(r.startedAt);
            const end = new Date(r.endedAt);
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

    /* Detail sub-rows for sow/spray/harvest data */
    .detail-row {
        background: ${colors.SECONDARY_LIGHT} !important;
    }
    .detail-row td {
        border-bottom: 1px solid ${colors.PRIMARY_LIGHT};
    }
    .detail-cell {
        padding: 4px 6px 6px 20px !important;
        font-size: 8px;
        color: ${colors.PRIMARY_LIGHT};
        line-height: 1.4;
    }
    .detail-items {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
    }
    .detail-item strong {
        color: ${colors.PRIMARY};
        font-weight: 500;
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

function generateHeader(farmName, dateRange, totalRecords, locale = DEFAULT_LOCALE) {
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
                    ${formatDate(new Date(), locale)} • ${dateRangeText} • ${formatNumber(totalRecords, locale)} records
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate detail sub-row for sow jobs
 */
function generateSowDetails(r, locale) {
	const cultivation = r.cultivation || {};
	const sowData = r.data?.sow || {};

	const items = [];
	if (cultivation.crop) items.push(`<span class="detail-item"><strong>Crop:</strong> ${escapeHtml(cultivation.crop)}</span>`);
	if (cultivation.variety) items.push(`<span class="detail-item"><strong>Variety:</strong> ${escapeHtml(cultivation.variety)}</span>`);
	if (sowData.lotNumber) items.push(`<span class="detail-item"><strong>Lot #:</strong> ${escapeHtml(sowData.lotNumber)}</span>`);
	if (sowData.seedManufacturer) items.push(`<span class="detail-item"><strong>Manufacturer:</strong> ${escapeHtml(sowData.seedManufacturer)}</span>`);
	if (sowData.eppoCode) items.push(`<span class="detail-item"><strong>EPPO:</strong> ${escapeHtml(sowData.eppoCode)}</span>`);

	if (items.length === 0) return '';

	return `
        <tr class="detail-row">
            <td colspan="6" class="detail-cell">
                <div class="detail-items">${items.join('')}</div>
            </td>
        </tr>
    `;
}

/**
 * Generate detail sub-row for spray jobs
 */
function generateSprayDetails(r, maps, locale) {
	const sprayData = r.data?.spray || {};

	const items = [];

	// Products
	if (sprayData.products && sprayData.products.length > 0) {
		const productDetails = sprayData.products.map(p => {
			const productName = p.name || maps.productMap?.[p.id] || 'Unknown Product';
			const rate = p.rate != null ? ` @ ${formatNumber(p.rate, locale)} L/ha` : '';
			return escapeHtml(productName) + rate;
		}).join(', ');
		items.push(`<span class="detail-item"><strong>Products:</strong> ${productDetails}</span>`);
	}

	// Application details
	if (sprayData.carrierRate != null) items.push(`<span class="detail-item"><strong>Carrier:</strong> ${formatNumber(sprayData.carrierRate, locale)} L/ha</span>`);
	if (sprayData.coveredArea != null) items.push(`<span class="detail-item"><strong>Area:</strong> ${formatNumber(sprayData.coveredArea, locale, { maximumFractionDigits: 2 })} ha</span>`);
	if (sprayData.totalWater != null) items.push(`<span class="detail-item"><strong>Water:</strong> ${formatNumber(sprayData.totalWater, locale)} L</span>`);

	if (items.length === 0) return '';

	return `
        <tr class="detail-row">
            <td colspan="6" class="detail-cell">
                <div class="detail-items">${items.join('')}</div>
            </td>
        </tr>
    `;
}

/**
 * Generate detail sub-row for harvest jobs
 */
function generateHarvestDetails(r, locale) {
	const harvestData = r.data?.harvest || {};

	const items = [];
	if (harvestData.yield != null) items.push(`<span class="detail-item"><strong>Yield:</strong> ${formatNumber(harvestData.yield, locale)} kg</span>`);
	if (harvestData.moisture != null) items.push(`<span class="detail-item"><strong>Moisture:</strong> ${formatNumber(harvestData.moisture, locale)}%</span>`);

	if (items.length === 0) return '';

	return `
        <tr class="detail-row">
            <td colspan="6" class="detail-cell">
                <div class="detail-items">${items.join('')}</div>
            </td>
        </tr>
    `;
}

function generateJobTable(records, maps, locale = DEFAULT_LOCALE) {
	if (!records || records.length === 0) {
		return '<div class="no-data">No records found</div>';
	}

	const rows = records.map(r => {
		// Job records use: type (not jobType), startedAt (not startTime), machine.name/machine.id
		const machineName = r.machine?.name || maps.machineMap[r.machine?.id] || '-';

		// Main row
		let rowHtml = `
        <tr>
            <td>${formatDate(r.startedAt, locale)}</td>
            <td>${capitalizeFirst(escapeHtml(r.type))}</td>
            <td>${escapeHtml(maps.fieldMap[r.fieldId] || 'Unknown')}</td>
            <td>${escapeHtml(machineName)}</td>
            <td>${formatDuration(getRecordDurationMs(r))}</td>
            <td>${escapeHtml(r.notes || '-')}</td>
        </tr>`;

		// Add detail sub-row based on job type
		if (r.type === 'sow') {
			rowHtml += generateSowDetails(r, locale);
		} else if (r.type === 'spray') {
			rowHtml += generateSprayDetails(r, maps, locale);
		} else if (r.type === 'harvest') {
			rowHtml += generateHarvestDetails(r, locale);
		}

		return rowHtml;
	}).join('');

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

function generateGroupedReport(records, groupKey, groupMap, maps, locale = DEFAULT_LOCALE) {
	const groups = {};

	records.forEach(r => {
		let label;

		// Handle different group key types
		if (groupKey === 'type') {
			// For job type grouping, prefer template name for custom jobs
			if (r.type === 'custom' && r.template?.name) {
				label = r.template.name;
			} else {
				label = capitalizeFirst(r.type || 'Unknown');
			}
		} else if (groupKey === 'fieldId') {
			// Field ID is a string, look up in map
			label = groupMap[r.fieldId] || 'Unknown Field';
		} else if (groupKey === 'machine' || groupKey === 'attachment' || groupKey === 'tool') {
			// These are objects with { id, name }
			const obj = r[groupKey];
			if (!obj) {
				label = 'No ' + capitalizeFirst(groupKey);
			} else if (obj.name) {
				label = obj.name;
			} else if (obj.id && groupMap[obj.id]) {
				label = groupMap[obj.id];
			} else {
				label = 'Unknown ' + capitalizeFirst(groupKey);
			}
		} else {
			// Fallback for any other groupKey
			const rawValue = r[groupKey];
			if (!rawValue) {
				label = 'No ' + capitalizeFirst(groupKey.replace('Id', ''));
			} else if (groupMap && groupMap[rawValue]) {
				label = groupMap[rawValue];
			} else {
				label = capitalizeFirst(String(rawValue));
			}
		}

		if (!groups[label]) groups[label] = [];
		groups[label].push(r);
	});

	return Object.entries(groups)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([label, recs]) => `
            <div class="section">
                <div class="group-header">${escapeHtml(label)} (${formatNumber(recs.length, locale)} jobs)</div>
                ${generateJobTable(recs, maps, locale)}
            </div>
        `).join('');
}

function generateReportHtml(data) {
	const { reportType, dateRange, farmName, jobRecords, fieldMap, machineMap, attachmentMap, toolMap, productMap, locale = DEFAULT_LOCALE } = data;
	const maps = { fieldMap, machineMap, attachmentMap, toolMap, productMap };

	let content;
	switch (reportType) {
		case 'field':
			content = generateGroupedReport(jobRecords, 'fieldId', fieldMap, maps, locale);
			break;
		case 'machine':
			content = generateGroupedReport(jobRecords, 'machine', machineMap, maps, locale);
			break;
		case 'job_type':
			content = generateGroupedReport(jobRecords, 'type', {}, maps, locale);
			break;
		case 'attachment':
			content = generateGroupedReport(jobRecords, 'attachment', attachmentMap, maps, locale);
			break;
		case 'tool':
			content = generateGroupedReport(jobRecords, 'tool', toolMap, maps, locale);
			break;
		default:
			content = `<div class="section">${generateJobTable(jobRecords, maps, locale)}</div>`;
	}

	return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${baseStyles}</style>
        </head>
        <body>
            ${generateHeader(farmName, dateRange, jobRecords.length, locale)}
            ${content}
            <div class="footer">
                Generated by Farmestly • ${new Date().getFullYear()}
            </div>
        </body>
        </html>
    `;
}

module.exports = { generateReportHtml, formatNumber, formatDate };