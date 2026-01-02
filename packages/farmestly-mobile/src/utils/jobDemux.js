/**
 * jobDemux.js
 *
 * Utility functions to demultiplex multi-field batch jobs into individual field payloads.
 * Each payload contains field-specific data plus shared embedded equipment objects and batch metadata.
 *
 * Per-field calculated amounts (water volume, product amounts) are NOT stored in payloads
 * to avoid data duplication - they are derived at display time using simple multiplication
 * and only stored permanently when the job record is finalized for server sync.
 */

/**
 * Demultiplex a spray job across multiple fields
 *
 * @param {Array} fields - Array of field objects: [{ _id, name, area, currentCultivation }, ...]
 * @param {Object} sharedConfig - Shared spray configuration:
 *   {
 *     machine: { id, name, make } | null,  // Embedded equipment object
 *     attachment: { id, name, type } | null,  // Embedded equipment object
 *     tool: { id, name, brand } | null,  // Embedded equipment object
 *     template: { id, name } | null,  // Template reference
 *     carrierRate,  // L/m² in base SI units
 *     products: [{ productId, name, rate, isVolume, rei, phi }],  // rate in base SI (L/m² or kg/m²)
 *     complianceInfo: { maxREI, maxPHI, reentryDate, harvestDate },
 *     sprayer: { id, name, type, tankCapacity }  // For batch calculations
 *   }
 * @returns {Array} Array of job payload objects, one per field
 */
export function demuxSprayJob(fields, sharedConfig) {
  // Generate unique batch ID
  const batchId = "batch_" + Date.now();

  // Calculate batch-level totals
  const totalArea = fields.reduce((sum, f) => sum + f.area, 0);
  const totalWater = sharedConfig.carrierRate * totalArea;
  const tanksRequired = Math.ceil(totalWater / sharedConfig.sprayer.tankCapacity);

  // Extract field IDs for batch tracking
  const fieldIds = fields.map(f => f._id);

  // Create individual payloads for each field
  return fields.map((field, index) => ({
    fieldId: field._id,
    fieldName: field.name,
    fieldArea: field.area,
    cultivation: field.currentCultivation ? {
      id: field.currentCultivation.id,
      crop: field.currentCultivation.crop,
      variety: field.currentCultivation.variety
    } : null,

    // Shared embedded equipment objects
    template: sharedConfig.template,
    machine: sharedConfig.machine,
    attachment: sharedConfig.attachment,
    tool: sharedConfig.tool,

    // Spray-specific data nested under data.spray
    data: {
      spray: {
        sprayerId: sharedConfig.sprayer.id,
        sprayerName: sharedConfig.sprayer.name,
        sprayerType: sharedConfig.sprayer.type,
        tankCapacity: sharedConfig.sprayer.tankCapacity,
        carrierRate: sharedConfig.carrierRate,
        products: sharedConfig.products, // Passed through unchanged - rates are shared
        complianceInfo: sharedConfig.complianceInfo
      }
    },

    // Batch metadata
    batch: {
      id: batchId,
      fieldIndex: index,
      totalArea,
      totalWater,
      tanksRequired,
      fieldIds
    }
  }));
}

/**
 * Demultiplex an irrigation job across multiple fields
 *
 * @param {Array} fields - Array of field objects: [{ _id, name, area, currentCultivation }, ...]
 * @param {Object} sharedConfig - Shared irrigation configuration:
 *   {
 *     machine: { id, name, make } | null,  // Embedded equipment object
 *     attachment: { id, name, type } | null,  // Embedded equipment object
 *     tool: { id, name, brand } | null,  // Embedded equipment object
 *     template: { id, name } | null,  // Template reference
 *     irrigator: { id, name, litersPerHour }  // For batch calculations
 *   }
 * @returns {Array} Array of job payload objects, one per field
 */
export function demuxIrrigationJob(fields, sharedConfig) {
  // Generate unique batch ID
  const batchId = "batch_" + Date.now();

  // Extract field IDs for batch tracking
  const fieldIds = fields.map(f => f._id);

  // Create individual payloads for each field
  return fields.map((field, index) => ({
    fieldId: field._id,
    fieldName: field.name,
    fieldArea: field.area,
    cultivation: field.currentCultivation ? {
      id: field.currentCultivation.id,
      crop: field.currentCultivation.crop,
      variety: field.currentCultivation.variety
    } : null,

    // Shared embedded equipment objects
    template: sharedConfig.template,
    machine: sharedConfig.machine,
    attachment: sharedConfig.attachment,
    tool: sharedConfig.tool,

    // Irrigation-specific data nested under data.irrigate
    data: {
      irrigate: {
        irrigatorId: sharedConfig.irrigator.id,
        irrigatorName: sharedConfig.irrigator.name,
        litersPerHour: sharedConfig.irrigator.litersPerHour
      }
    },

    // Batch metadata (simpler for irrigation - no pre-calculated water totals)
    batch: {
      id: batchId,
      fieldIndex: index,
      totalFields: fieldIds.length,
      fieldIds
    }
  }));
}
