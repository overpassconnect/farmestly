/**
 * Template Resolver Utility
 * Resolves template equipment references and validates templates for job recording
 */

/**
 * Resolves a job template by looking up equipment references and validating requirements
 * @param {Object} template - The template object with equipment IDs
 * @param {Object} farmData - The farm data containing machines, attachments, tools, products
 * @returns {Object} Resolved template with equipment objects, validation errors, and isValid flag
 */
export function resolveTemplate(template, farmData) {
	if (!template) {
		return {
			template: null,
			machine: null,
			attachment: null,
			tool: null,
			products: [],
			carrierRate: null,
			litersPerHour: null,
			errors: [{ field: 'template', message: 'Template not found' }],
			isValid: false
		};
	}

	const errors = [];
	let machine = null;
	let attachment = null;
	let tool = null;
	let products = [];
	let carrierRate = null;
	let litersPerHour = null;

	const machineId = template.machineId;
	if (machineId) {
		machine = farmData.machines?.find(m => m._id === machineId);
		if (!machine) {
			errors.push({
				field: 'machine',
				message: `Machine not found - it may have been deleted`
			});
		}
	}

	const attachmentId = template.attachmentId;
	if (attachmentId) {
		attachment = farmData.attachments?.find(a => a._id === attachmentId);
		if (!attachment) {
			errors.push({
				field: 'attachment',
				message: `Attachment not found - it may have been deleted`
			});
		}
	}

	const toolId = template.toolId;
	if (toolId) {
		tool = farmData.tools?.find(t => t._id === toolId);
		if (!tool) {
			errors.push({
				field: 'tool',
				message: `Tool not found - it may have been deleted`
			});
		}
	}

	// Type-specific validation and resolution
	switch (template.type) {
		case 'spray':
			// Validate: Must have sprayer (attachment with usedFor='spray' OR machine with usedFor='spray')
			const hasSprayerAttachment = attachment && attachment.usedFor === 'spray';
			const hasSprayerMachine = machine && machine.usedFor === 'spray';
			const hasSprayer = hasSprayerAttachment || hasSprayerMachine;

			if (!hasSprayer) {
				errors.push({
					field: 'sprayer',
					message: 'Spray job requires a sprayer (machine or attachment with spray capability)'
				});
			}

			// Resolve products (support both 'productId' and 'id')
			if (template.sprayConfig?.products && template.sprayConfig.products.length > 0) {
				products = template.sprayConfig.products
					.map(tp => {
						const productId = tp.productId || tp.id;
						const product = farmData.products?.find(p => p._id === productId);
						if (!product) {
							errors.push({
								field: 'product',
								message: `Product ${productId} not found - it may have been deleted`
							});
							return null;
						}
						return {
							...product,
							// Support both tp.rate and tp.overrides.rate
							templateRate: tp.overrides?.rate || tp.rate || null
						};
					})
					.filter(p => p !== null);
			}

			if (products.length === 0) {
				errors.push({
					field: 'products',
					message: 'Spray job requires at least one product'
				});
			}

			// Get carrier rate from template config, or fallback to equipment defaults
			carrierRate = template.sprayConfig?.carrierRate ||
				attachment?.defaultCarrierRate ||
				machine?.defaultCarrierRate ||
				null;
			break;

		case 'irrigate':
			// Validate: Must have irrigation attachment
			const hasIrrigationAttachment = attachment && attachment.usedFor === 'irrigate';
			if (!hasIrrigationAttachment) {
				errors.push({
					field: 'attachment',
					message: 'Irrigation job requires an irrigation attachment'
				});
			}
			litersPerHour = attachment?.litersPerHour || null;
			break;

		case 'sow':
		case 'harvest':
		case 'custom':
			// No required equipment for these types
			break;

		default:
			errors.push({
				field: 'type',
				message: `Unknown job type: ${template.type}`
			});
	}

	return {
		template,
		machine,
		attachment,
		tool,
		products,
		carrierRate,
		litersPerHour,
		errors,
		isValid: errors.length === 0
	};
}

/**
 * Helper function to get a user-friendly error message from resolved template
 * @param {Object} resolved - The resolved template object from resolveTemplate()
 * @returns {string} A formatted error message for display to user
 */
export function getTemplateErrorMessage(resolved) {
	if (resolved.isValid) {
		return null;
	}

	const errorMessages = resolved.errors.map(e => `• ${e.message}`).join('\n');
	return `This template has missing or deleted equipment:\n\n${errorMessages}\n\nYou can still proceed, but you'll need to select equipment manually.`;
}
