/**
 * Job Helper Functions
 *
 * Utilities for building job payloads with embedded equipment and cultivation data.
 * Used by job screens to prepare data for JobService.start()
 */

/**
 * Resolve equipment from template into embedded objects for job recording
 * @param {Object} farmData - The farm data object containing machines, attachments, tools
 * @param {Object} template - The job template with machineId, attachmentId, toolId references
 * @returns {Object} { machine, attachment, tool } with embedded objects or null
 */
export const resolveEquipment = (farmData, template) => ({
  machine: template.machineId
    ? ((m) => m && { id: m._id, name: m.name, make: m.make })(
        farmData.machines?.find(x => x._id === template.machineId)
      )
    : null,
  attachment: template.attachmentId
    ? ((a) => a && { id: a._id, name: a.name, type: a.type })(
        farmData.attachments?.find(x => x._id === template.attachmentId)
      )
    : null,
  tool: template.toolId
    ? ((t) => t && { id: t._id, name: t.name, brand: t.brand })(
        farmData.tools?.find(x => x._id === template.toolId)
      )
    : null
});

/**
 * Build cultivation object from field's current cultivation
 * @param {Object} field - The field object with currentCultivation
 * @returns {Object|null} Cultivation object { id, crop, variety } or null
 */
export const buildCultivation = (field) =>
  field.currentCultivation
    ? {
        id: field.currentCultivation.id,
        crop: field.currentCultivation.crop,
        variety: field.currentCultivation.variety
      }
    : null;

/**
 * Generate a temporary cultivation ID for new sow jobs
 * @returns {string} Temporary ID in format "temp_{timestamp}_{random}"
 */
export const tempCultivationId = () =>
  `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
